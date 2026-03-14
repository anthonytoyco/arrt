use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Transaction {
    pub transaction_id: String,
    pub order_id: Option<String>,
    pub customer_id: Option<String>,
    pub customer_name: Option<String>,
    pub timestamp: Option<String>,
    pub amount: Option<f64>,
    pub currency: Option<String>,
    pub payment_method: Option<String>,
    pub card_last4: Option<String>,
    pub card_brand: Option<String>,
    pub transaction_status: Option<String>,
    pub merchant_id: Option<String>,
    pub store_id: Option<String>,
    pub refund_status: Option<String>,
    pub ip_address: Option<String>,
    pub ip_country: Option<String>,
    pub ip_is_vpn: Option<bool>,
    pub device_type: Option<String>,
    pub address_match: Option<bool>,
    pub cvv_match: Option<bool>,
    pub avs_result: Option<String>,
    pub card_present: Option<bool>,
    pub entry_mode: Option<String>,
    pub amount_subtotal: Option<f64>,
    pub tax: Option<f64>,
    pub discount_applied: Option<f64>,
}
