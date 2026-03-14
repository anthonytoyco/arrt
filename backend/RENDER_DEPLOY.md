# Deploying the Rust Backend on Render

## Prerequisites

- A [Render](https://render.com) account
- Your repository pushed to GitHub or GitLab

## Important: Port Configuration

Render dynamically assigns a port via the `PORT` environment variable. The current `main.rs` hardcodes port `3000`, which will not work correctly on Render. Update `main.rs` to read from the environment:

```rust
let port: u16 = std::env::var("PORT")
    .unwrap_or_else(|_| "3000".to_string())
    .parse()
    .expect("PORT must be a number");

let addr = SocketAddr::from(([0, 0, 0, 0], port));
```

## Steps

### 1. Connect Your Repository

1. Log in to [Render](https://render.com) and go to the **Dashboard**.
2. Click **New** > **Web Service**.
3. Connect your GitHub/GitLab account and select the `arrt` repository.

### 2. Configure the Web Service

| Setting | Value |
|---|---|
| **Name** | `arrt-backend` (or your choice) |
| **Region** | Closest to your users |
| **Branch** | `main` |
| **Root Directory** | `backend/arrt` |
| **Runtime** | **Rust** |
| **Build Command** | `cargo build --release` |
| **Start Command** | `./target/release/my-backend` |

> The binary name `my-backend` matches the `name` field in [Cargo.toml](arrt/Cargo.toml).

### 3. Set Environment Variables

In the **Environment** section, add:

| Key | Value |
|---|---|
| `RUST_LOG` | `info` |

Render automatically injects the `PORT` variable — do not set it manually.

### 4. Choose a Plan

Select the **Free** tier for testing or a paid plan for production.

### 5. Deploy

Click **Create Web Service**. Render will:
1. Pull your code
2. Run `cargo build --release` (this takes a few minutes on first build)
3. Start the binary

Your service will be live at `https://<your-service-name>.onrender.com`.

## Subsequent Deploys

Render automatically redeploys on every push to the configured branch. You can also trigger a manual deploy from the Render dashboard.

## Troubleshooting

- **Build fails**: Check that `backend/arrt` is set as the root directory so Render can find `Cargo.toml`.
- **Service crashes on start**: Confirm the binary name in the start command matches the `name` in `Cargo.toml` (`my-backend`).
- **Port errors**: Ensure `main.rs` reads the `PORT` environment variable as shown above.
- **Logs**: View real-time logs in the Render dashboard under **Logs**.
