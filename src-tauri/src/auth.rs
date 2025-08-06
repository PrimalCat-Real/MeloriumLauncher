use std::env;

use bcrypt::verify;
use tauri::command;
use tokio_postgres::NoTls;



#[derive(serde::Serialize)]
pub struct AuthResult {
    is_authenticated: bool,
    uuid: Option<String>,
    accesstoken: Option<String>,
    error: Option<String>,
}


#[command]
pub async fn authenticate(login: String, password: String) -> Result<AuthResult, String> {

    dotenvy::dotenv().ok();

    let db_url = format!(
        "host={} port={} dbname={} user={} password={}",
        env::var("PG_HOST").unwrap_or_default(),
        env::var("PG_PORT").unwrap_or_else(|_| "5432".to_string()),
        env::var("PG_DATABASE").unwrap_or_default(),
        env::var("PG_USER").unwrap_or_default(),
        env::var("PG_PASSWORD").unwrap_or_default(),
    );

    let (client, connection) = tokio_postgres::connect(&db_url, NoTls)
        .await
        .map_err(|e| format!("Ошибка подключения к БД: {}", e))?;

    tauri::async_runtime::spawn(async move {
        if let Err(e) = connection.await {
            eprintln!("Ошибка подключения: {}", e);
        }
    });

    let query = "
        SELECT uuid, user_password, is_active, accesstoken
        FROM adm.adm_user_v
        WHERE user_login = $1
    ";

    let row_opt = client.query_opt(query, &[&login])
        .await
        .map_err(|e| format!("Ошибка запроса: {}", e))?;

    if let Some(row) = row_opt {
        let uuid: String = row.get("uuid");
        let hash: String = row.get("user_password");
        let is_active: bool = row.get("is_active");
        let accesstoken: String = row.get("access_token");

        if !verify(&password, &hash).map_err(|e| e.to_string())? {
            return Ok(AuthResult {
                is_authenticated: false,
                uuid: None,
                accesstoken: None,
                error: Some("Неверный пароль".into()),
            });
        }

        if !is_active {
            return Ok(AuthResult {
                is_authenticated: false,
                uuid: None,
                accesstoken: None,
                error: Some("Аккаунт не прошел проверку".into()),
            });
        }

        Ok(AuthResult {
            is_authenticated: true,
            uuid: Some(uuid),
            accesstoken: Some(accesstoken),
            error: None,
        })
    } else {
        Ok(AuthResult {
            is_authenticated: false,
            uuid: None,
            accesstoken: None,
            error: Some("Пользователь не найден".into()),
        })
    }
}