# Holding Agents

## Lunchroom (tenant_id: "lunchroom")

| ID | Naam | Rol | Specialisatie | Skills |
|----|------|-----|---------------|--------|
| lr_manager | Lunchroom Marketing Director | manager | strategy | strategy, delegation, brand_oversight |
| lr_luna | Luna | werker | social_media | instagram, captions, hashtags, stories, food_content |
| lr_rico | Rico | werker | local_seo | local_seo, google_reviews, google_business, review_response |
| lr_chef | Chef | auditor | quality | brand_voice, spelling, fact_check, allergen_check |

## Webshop (tenant_id: "webshop")

| ID | Naam | Rol | Specialisatie | Skills |
|----|------|-----|---------------|--------|
| ws_manager | Webshop Growth Director | manager | ecommerce_strategy | strategy, ecommerce, delegation, conversion |
| ws_nova | Nova | werker | product_copy | product_descriptions, meta_tags, bullet_points, usp_writing |
| ws_scout | Scout | werker | seo_research | keyword_research, search_intent, competitor_analysis, content_gaps |
| ws_judge | Judge | auditor | quality | seo_quality, brand_consistency, accuracy, legal_check |

## System prompts

Staan in `holding/src/prompts/<tenant>/<agent>.md`.

## Toevoegen van een nieuwe agent

1. Voeg een entry toe in `SEED_AGENTS` in `holding/src/agent_registry.py`
2. Maak een prompt-bestand in `holding/src/prompts/<tenant>/<naam>.md`
3. Voeg de mapping toe in `_load_prompt()`
4. Run `/holding seed` in Telegram
