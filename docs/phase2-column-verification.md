# Phase 2 Column Verification

**Generated:** 2026-06-21T18:04:37.955Z
**Host:** 122.184.128.90:3306
**User:** shivam_user

---

## Shivamgiri.v_call_master_unified_kpi

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| source_call_id | bigint | NO |  | 0 |  |
| source_type | varchar(8) | YES |  | NULL |  |
| client_id | varchar(45) | YES |  | NULL |  |
| process_name | varchar(255) | YES |  | NULL |  |
| business_lob | varchar(100) | YES |  | NULL |  |
| branch_short_name | varchar(100) | YES |  | NULL |  |
| campaign_name | varchar(50) | YES |  | NULL |  |
| lead_id | varchar(45) | YES |  | NULL |  |
| source_agent_name | varchar(255) | YES |  | NULL |  |
| agent_employee_code | varchar(100) | YES |  | NULL |  |
| agent_employee_name | varchar(255) | YES |  | NULL |  |
| call_datetime | datetime | YES |  | NULL |  |
| call_date | date | YES |  | NULL |  |
| quality_score | decimal(33,30) | YES |  | NULL |  |
| total_score | int | YES |  | NULL |  |
| max_score | int | YES |  | NULL |  |
| quality_band | varchar(17) | YES |  | NULL |  |
| is_critical_call | int | NO |  | 0 |  |
| alert_severity | varchar(8) | YES |  | NULL |  |

**Total columns:** 19

## Shivamgiri.v_call_master_inbound_kpi

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| source_call_id | int | NO |  | 0 |  |
| source_type | varchar(7) | NO |  |  |  |
| client_id | varchar(45) | NO |  | NULL |  |
| process_name | varchar(255) | NO |  | NULL |  |
| business_lob | varchar(100) | NO |  | NULL |  |
| branch_short_name | varchar(100) | NO |  | NULL |  |
| campaign_name | varchar(45) | YES |  | NULL |  |
| lead_id | varchar(45) | YES |  | NULL |  |
| source_agent_name | varchar(45) | YES |  | NULL |  |
| agent_employee_code | varchar(100) | YES |  | NULL |  |
| agent_employee_name | varchar(255) | YES |  | NULL |  |
| call_datetime | datetime | YES |  | NULL |  |
| call_date | date | YES |  | NULL |  |
| quality_score | decimal(5,2) | YES |  | NULL |  |
| total_score | int | YES |  | NULL |  |
| max_score | int | YES |  | NULL |  |
| quality_band | varchar(8) | NO |  |  |  |
| is_critical_call | int | NO |  | 0 |  |
| alert_severity | varchar(8) | NO |  |  |  |

**Total columns:** 19

## Shivamgiri.v_call_master_outbound_kpi

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| source_call_id | int unsigned | NO |  | 0 |  |
| source_type | varchar(8) | NO |  |  |  |
| client_id | varchar(11) | YES |  | NULL |  |
| process_name | varchar(255) | NO |  | NULL |  |
| business_lob | varchar(100) | NO |  | NULL |  |
| branch_short_name | varchar(100) | NO |  | NULL |  |
| campaign_name | varchar(50) | YES |  | NULL |  |
| lead_id | int | YES |  | NULL |  |
| source_agent_name | varchar(255) | YES |  | NULL |  |
| agent_employee_code | varchar(100) | YES |  | NULL |  |
| agent_employee_name | varchar(255) | YES |  | NULL |  |
| call_datetime | datetime | YES |  | NULL |  |
| call_date | date | YES |  | NULL |  |
| quality_score | binary(0) | YES |  | NULL |  |
| total_score | binary(0) | YES |  | NULL |  |
| max_score | binary(0) | YES |  | NULL |  |
| quality_band | varchar(17) | NO |  |  |  |
| is_critical_call | int | NO |  | 0 |  |
| alert_severity | varchar(6) | NO |  |  |  |

**Total columns:** 19

## db_external.CallDetails

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int unsigned | NO | PRI | NULL | auto_increment |
| client_id | int | YES | MUL | NULL |  |
| campaign_id | varchar(50) | YES |  | NULL |  |
| length_in_sec | varchar(50) | YES |  | NULL |  |
| start_epoch | varchar(50) | YES |  | NULL |  |
| end_epoch | varchar(50) | YES |  | NULL |  |
| CallDate | datetime | YES | MUL | NULL |  |
| LeadID | int | YES |  | NULL |  |
| AgentName | varchar(255) | YES |  | NULL |  |
| MobileNo | varchar(15) | YES |  | NULL |  |
| CompetitorName | varchar(255) | YES |  | NULL |  |
| Opening | text | YES |  | NULL |  |
| Offered | text | YES |  | NULL |  |
| ObjectionHandling | text | YES |  | NULL |  |
| PrepaidPitch | text | YES |  | NULL |  |
| UpsellingEfforts | text | YES |  | NULL |  |
| OfferUrgency | text | YES |  | NULL |  |
| SensitiveWordUsed | text | YES |  | NULL |  |
| SensitiveWordContext | text | YES |  | NULL |  |
| AreaForImprovement | text | YES |  | NULL |  |
| TranscribeText | text | YES |  | NULL |  |
| TopNegativeWordsByAgent | text | YES |  | NULL |  |
| TopNegativeWordsByCustomer | text | YES |  | NULL |  |
| LengthSec | varchar(10) | YES |  | NULL |  |
| StartTime | varchar(10) | YES |  | NULL |  |
| EndTime | varchar(10) | YES |  | NULL |  |
| CallDisposition | text | YES |  | NULL |  |
| OpeningRejected | varchar(50) | YES |  | NULL |  |
| OfferingRejected | varchar(50) | YES |  | NULL |  |
| AfterListeningOfferRejected | varchar(50) | YES |  | NULL |  |
| SaleDone | varchar(50) | YES |  | NULL |  |
| NotInterestedReasonCallContext | text | YES |  | NULL |  |
| NotInterestedBucketReason | text | YES |  | NULL |  |
| OpeningPitchContext | text | YES |  | NULL |  |
| OfferedPitchContext | text | YES |  | NULL |  |
| ObjectionHandlingContext | text | YES |  | NULL |  |
| PrepaidPitchContext | text | YES |  | NULL |  |
| FileName | text | YES |  | NULL |  |
| Status | int | YES |  | 0 |  |
| Category | text | YES |  | NULL |  |
| SubCategory | text | YES |  | NULL |  |
| CustomerObjectionCategory | text | YES |  | NULL |  |
| CustomerObjectionSubCategory | text | YES |  | NULL |  |
| AgentRebuttalCategory | text | YES |  | NULL |  |
| AgentRebuttalSubCategory | text | YES |  | NULL |  |
| ProductOffering | text | YES |  | NULL |  |
| DiscountType | text | YES |  | NULL |  |
| OpeningPitchCategory | text | YES |  | NULL |  |
| ContactSettingContext | text | YES |  | NULL |  |
| ContactSettingCategory | text | YES |  | NULL |  |
| ContactSetting2 | text | YES |  | NULL |  |
| Feedback_Category | text | YES |  | NULL |  |
| FeedbackContext | text | YES |  | NULL |  |
| Feedback | text | YES |  | NULL |  |
| Age | text | YES |  | NULL |  |
| ConsumptionType | text | YES |  | NULL |  |
| AgeofConsumption | text | YES |  | NULL |  |
| ReasonforQuitting | text | YES |  | NULL |  |
| entrydate | varchar(100) | YES |  | NULL |  |
| Sale_Pitch_Discount_Structure | text | YES |  | NULL |  |
| Limited_Time_Offer | text | YES |  | NULL |  |
| Snapmint_Pitch | text | YES |  | NULL |  |
| Feedback_Capture | text | YES |  | NULL |  |
| Acknowledgement | text | YES |  | NULL |  |
| Apology_Assurance | text | YES |  | NULL |  |
| Pronunciation_Skills_Checklist | text | YES |  | NULL |  |
| Product_Appreciation | text | YES |  | NULL |  |
| Customer_Details_Confirmation | text | YES |  | NULL |  |
| Delivery_TAT | text | YES |  | NULL |  |
| Order_Consent | text | YES |  | NULL |  |
| Reconfirmation | text | YES |  | NULL |  |
| Order_Summary | text | YES |  | NULL |  |
| Further_Assistance | text | YES |  | NULL |  |
| Call_Closing | text | YES |  | NULL |  |
| Product_Description_Guideline | text | YES |  | NULL |  |
| Alternative_Suggestion | text | YES |  | NULL |  |
| Reason_for_Not_Placing_Order | text | YES |  | NULL |  |
| Pricing_and_Discount_Structure | text | YES |  | NULL |  |

**Total columns:** 78

