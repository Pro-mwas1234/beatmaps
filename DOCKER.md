# BeatMaps Docker Deployment Guide

## Quick Start with Docker

### Option 1: Docker Compose (Recommended)

```bash
# Build and run the application
docker-compose up -d --build

# View logs
docker-compose logs -f beatmaps

# Stop the application
docker-compose down
```

The app will be available at: http://localhost:3000

### Option 2: Direct Docker Commands

```bash
# Build the Docker image
docker build -t beatmaps-app .

# Run the container
docker run -d -p 3000:80 --name beatmaps beatmaps-app

# View logs
docker logs -f beatmaps

# Stop the container
docker stop beatmaps && docker rm beatmaps
```

## Configuration

### Spotify Setup

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new application
3. Get your Client ID
4. Add `http://localhost:3000` (or your domain) to Redirect URIs
5. In the app, go to Settings → Enter your Spotify Client ID

### Environment Variables (Optional)

If you need to pass environment variables at runtime:

```bash
docker run -d -p 3000:80 \
  -e SPOTIFY_CLIENT_ID=your_client_id \
  beatmaps-app
```

Or in docker-compose.yml:
```yaml
environment:
  - SPOTIFY_CLIENT_ID=your_client_id
```

## Production Deployment

### With Custom Domain

1. Update the port mapping in docker-compose.yml if needed
2. Set up a reverse proxy (nginx, traefik, etc.)
3. Configure SSL certificates
4. Update Spotify Redirect URI to your domain

### Example with Nginx Reverse Proxy

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  beatmaps:
    build: .
    expose:
      - "80"
  
  nginx-proxy:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx-prod.conf:/etc/nginx/nginx.conf
      - ./certs:/etc/nginx/certs
    depends_on:
      - beatmaps
```

## Health Check

The container includes a health check that runs every 30 seconds:

```bash
# Check container health
docker inspect --format='{{.State.Health.Status}}' beatmaps

# Should return: healthy
```

## Updating the Application

```bash
# Rebuild and restart
docker-compose up -d --build

# Or with direct docker
docker stop beatmaps && docker rm beatmaps
docker build -t beatmaps-app .
docker run -d -p 3000:80 --name beatmaps beatmaps-app
```

## Troubleshooting

### Container won't start
```bash
# Check logs
docker-compose logs beatmaps

# Verify build
docker-compose build --no-cache
```

### Port already in use
Change the port mapping in docker-compose.yml:
```yaml
ports:
  - "8080:80"  # Use port 8080 instead of 3000
```

### Spotify authentication issues
1. Verify Client ID is correct
2. Check Redirect URI matches your domain
3. Ensure HTTPS is configured for production domains

## Resource Usage

- **Image Size**: ~50MB (optimized multi-stage build)
- **Memory**: ~100MB typical usage
- **CPU**: Minimal when idle

## Security Notes

- The container runs as non-root user (nginx default)
- Security headers are configured in nginx
- Regular dependency updates recommended
- Use HTTPS in production

## Scaling

For multiple instances behind a load balancer:

```bash
docker-compose up -d --scale beatmaps=3
```

Note: Session state is client-side, so no sticky sessions required.
