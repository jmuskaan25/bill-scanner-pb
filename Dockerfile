FROM alpine:3.19

ARG PB_VERSION=0.36.9

RUN apk add --no-cache ca-certificates unzip

ADD https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip /tmp/pb.zip
RUN unzip /tmp/pb.zip -d /app/ && rm /tmp/pb.zip

COPY pb_hooks/ /app/pb_hooks/
COPY index.html styles.css app.js submissions.js manage.js submissions.html manage.html /app/public/

EXPOSE 8080

CMD ["/app/pocketbase", "serve", \
     "--http=0.0.0.0:8080", \
     "--dir=/app/pb_data", \
     "--hooksDir=/app/pb_hooks", \
     "--publicDir=/app/public"]
