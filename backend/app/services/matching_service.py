"""
Product matching service.
Uses exact match → fuzzy match → semantic similarity (optional).
"""
import re
from typing import Optional
from dataclasses import dataclass

from rapidfuzz import fuzz, process
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.models import Product, MatchConfidence
from app.core.config import settings

import logging
logger = logging.getLogger(__name__)


@dataclass
class MatchResult:
    product_id: Optional[str]
    sku: Optional[str]
    description: Optional[str]
    price: Optional[float]
    confidence: MatchConfidence
    confidence_score: float
    match_method: str
    warnings: list[str]


_product_cache: list[dict] = []
_cache_version: int = 0


async def _load_products(db: AsyncSession) -> list[dict]:
    result = await db.execute(select(Product).where(Product.is_active == True))
    products = result.scalars().all()
    return [
        {
            "id": p.id,
            "sku": p.sku,
            "description": p.description,
            "price": p.price,
            "synonyms": p.synonyms or [],
            "search_terms": _build_search_terms(p),
        }
        for p in products
    ]


def _build_search_terms(product: Product) -> list[str]:
    terms = [product.description]
    if product.synonyms:
        terms.extend(product.synonyms)
    return [_normalize(t) for t in terms if t]


def _normalize(text: str) -> str:
    text = str(text).lower().strip()
    text = re.sub(r"[.\-_]", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text


def _confidence_from_score(score: float) -> MatchConfidence:
    if score >= 90:
        return MatchConfidence.HIGH
    elif score >= settings.FUZZY_MATCH_THRESHOLD:
        return MatchConfidence.MEDIUM
    else:
        return MatchConfidence.LOW


async def match_product(
    description: str,
    unit_price: Optional[float],
    db: AsyncSession,
) -> MatchResult:
    products = await _load_products(db)

    if not products:
        return MatchResult(
            product_id=None, sku=None, description=None, price=None,
            confidence=MatchConfidence.NONE, confidence_score=0.0,
            match_method="no_products", warnings=["No products in database"]
        )

    norm_desc = _normalize(description)
    warnings: list[str] = []

    # 1. Exact match against SKU
    for p in products:
        if _normalize(p["sku"]) == norm_desc:
            return _build_result(p, 100.0, "exact_sku", unit_price, warnings)

    # 2. Exact match against description / synonyms
    for p in products:
        for term in p["search_terms"]:
            if term == norm_desc:
                return _build_result(p, 100.0, "exact_description", unit_price, warnings)

    # 3. Fuzzy matching against all search terms
    all_choices: dict[str, dict] = {}
    for p in products:
        for term in p["search_terms"]:
            all_choices[term] = p

    best_match = process.extractOne(
        norm_desc,
        all_choices.keys(),
        scorer=fuzz.token_set_ratio,
        score_cutoff=settings.FUZZY_MATCH_THRESHOLD - 10,
    )

    if best_match:
        matched_term, score, _ = best_match
        product = all_choices[matched_term]
        confidence = _confidence_from_score(score)

        if unit_price is not None and product["price"] > 0:
            price_diff = abs(unit_price - product["price"]) / product["price"]
            if price_diff > 0.15:
                warnings.append(
                    f"Price mismatch: order {unit_price:.2f} vs catalog {product['price']:.2f}"
                )

        return _build_result(product, score, "fuzzy", unit_price, warnings)

    # 4. No match
    warnings.append(f"No match found for: {description}")
    return MatchResult(
        product_id=None, sku=None, description=None, price=None,
        confidence=MatchConfidence.NONE, confidence_score=0.0,
        match_method="none", warnings=warnings
    )


def _build_result(
    product: dict,
    score: float,
    method: str,
    unit_price: Optional[float],
    warnings: list[str],
) -> MatchResult:
    confidence = _confidence_from_score(score)
    price = unit_price if unit_price is not None else product["price"]

    if unit_price is not None and product["price"] > 0:
        price_diff = abs(unit_price - product["price"]) / product["price"]
        if price_diff > 0.15:
            warn = f"Price mismatch: order {unit_price:.2f} vs catalog {product['price']:.2f}"
            if warn not in warnings:
                warnings.append(warn)

    return MatchResult(
        product_id=product["id"],
        sku=product["sku"],
        description=product["description"],
        price=price,
        confidence=confidence,
        confidence_score=round(score, 1),
        match_method=method,
        warnings=warnings,
    )
