FROM nginx:stable-alpine
COPY . /usr/share/nginx/html
EXPOSE 80
