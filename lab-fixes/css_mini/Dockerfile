FROM nginx:alpine

# Copy web files to nginx document root
COPY . /usr/share/nginx/html/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
