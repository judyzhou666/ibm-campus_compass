use std::{env, net::SocketAddr};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let provider = env::var("PLANNER_PROVIDER").unwrap_or_else(|_| "simulated".into());
    if provider != "simulated" {
        return Err("Only PLANNER_PROVIDER=simulated is implemented. Add a Rust watsonx interpreter before selecting live mode; see docs/backend.md.".into());
    }
    let addr: SocketAddr = env::var("CAMPUS_ADDR")
        .unwrap_or_else(|_| "127.0.0.1:4173".into())
        .parse()?;
    let listener = tokio::net::TcpListener::bind(addr).await?;
    println!(
        "Campus Compass: http://{} (Rust backend, simulated planner)",
        listener.local_addr()?
    );
    axum::serve(listener, campus_compass::app())
        .with_graceful_shutdown(async {
            let _ = tokio::signal::ctrl_c().await;
        })
        .await?;
    Ok(())
}
