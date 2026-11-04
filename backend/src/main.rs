use campus_compass::{
    Provider, app_with,
    watsonx::{WatsonxConfig, WatsonxInterpreter},
};
use std::{env, net::SocketAddr};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let selected = env::var("PLANNER_PROVIDER").unwrap_or_else(|_| "simulated".into());
    let (provider, label) = match selected.as_str() {
        "simulated" => (Provider::Simulated, "simulated planner".to_string()),
        "watsonx" => {
            let config = WatsonxConfig::from_env()?;
            let label = format!(
                "IBM watsonx planner ({}, {}); simulated fallback on failure",
                config.model_id, config.url
            );
            (
                Provider::Watsonx(Box::new(WatsonxInterpreter::new(config)?)),
                label,
            )
        }
        other => {
            return Err(format!(
                "Unknown PLANNER_PROVIDER={other:?}. Use \"simulated\" (default) or \"watsonx\"; see docs/backend.md."
            )
            .into());
        }
    };
    let addr: SocketAddr = env::var("CAMPUS_ADDR")
        .unwrap_or_else(|_| "127.0.0.1:4173".into())
        .parse()?;
    let listener = tokio::net::TcpListener::bind(addr).await?;
    println!(
        "Campus Compass: http://{} (Rust backend, {label})",
        listener.local_addr()?
    );
    axum::serve(listener, app_with(provider))
        .with_graceful_shutdown(async {
            let _ = tokio::signal::ctrl_c().await;
        })
        .await?;
    Ok(())
}
