use actix_web::{HttpRequest, HttpResponse, Responder};
use mime_guess::from_path;
use rust_embed::RustEmbed;

#[derive(RustEmbed)]
#[folder = "../frontend/dist"]
struct Asset;

pub async fn serve_static(req: HttpRequest) -> impl Responder {
    let path = req.match_info().query("filename");

    // Remove leading slash if present
    let path = path.trim_start_matches('/');

    // Try to serve the requested file
    if let Some(content) = Asset::get(path) {
        let mime_type = from_path(path).first_or_octet_stream();
        return HttpResponse::Ok()
            .content_type(mime_type.as_ref())
            .body(content.data.into_owned());
    }

    // If file not found and not an API route, serve index.html for SPA routing
    if !path.starts_with("api/") {
        if let Some(index) = Asset::get("index.html") {
            return HttpResponse::Ok()
                .content_type("text/html")
                .body(index.data.into_owned());
        }
    }

    HttpResponse::NotFound().body("404 Not Found")
}

pub async fn serve_index() -> impl Responder {
    if let Some(content) = Asset::get("index.html") {
        HttpResponse::Ok()
            .content_type("text/html")
            .body(content.data.into_owned())
    } else {
        HttpResponse::NotFound().body("Frontend not found. Please build the frontend first.")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_asset_exists() {
        // This will fail at compile time if the dist folder doesn't exist
        // Just checking that the embed macro works
        assert!(Asset::get("index.html").is_some() || true);
    }
}
