# Stage 1: Build the landing page
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source and config files needed for the build
COPY src-landing/ src-landing/
COPY public/ public/
COPY vite.config.landing.ts tsconfig.landing.json ./

# Build the landing page
RUN npm run build:landing

# Stage 2: Serve with nginx
FROM nginx:alpine AS production

# Copy the built static files
COPY --from=builder /app/dist-landing /usr/share/nginx/html

# Copy nginx configuration
COPY nginx-landing.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
