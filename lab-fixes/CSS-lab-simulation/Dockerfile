FROM nginx:alpine

# Copy static virtual lab assets to nginx web root
COPY index.html script.js style.css /usr/share/nginx/html/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
