FROM node:22-alpine
WORKDIR /app
ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=$VITE_API_URL
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 80
CMD ["npx", "vite", "preview", "--port", "80", "--host", "0.0.0.0"]
