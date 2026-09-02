# Etapa 1: compilar los archivos estaticos con Node
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# Las variables VITE_* se "hornean" adentro del JS compilado en el momento
# del build (npm run build) - a diferencia del backend, donde las variables
# de entorno se leen recien cuando el contenedor ARRANCA. Por eso ARG (que
# solo existe durante el build) + ENV (para que Vite las vea como si
# fueran del sistema) van ANTES de "npm run build", no despues.
ARG VITE_API_BASE_URL
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID

RUN npm run build

# Etapa 2: imagen final - solo nginx sirviendo lo que ya se compilo arriba.
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

