FROM node:20-alpine

WORKDIR /app

# Install deps first for better layer caching.
COPY package.json ./
RUN npm install

COPY . .

EXPOSE 3000
# Dev server with hot reload — source is bind-mounted in docker-compose.
CMD ["npm", "run", "dev"]
