# Stage 1: Build the React Application
FROM node:18-alpine AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ .
RUN npm run build

# Stage 2: Setup the Server
FROM node:18-alpine
WORKDIR /app
COPY server/package*.json ./
RUN npm install

# Copy server code
COPY server/ .

# Copy built client assets from Stage 1 to server's serve folder
COPY --from=client-build /app/client/dist ./client_build

EXPOSE 3000
CMD ["npm", "start"]
