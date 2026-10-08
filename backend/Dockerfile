FROM maven:3.9.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn -B -DskipTests package
FROM eclipse-temurin:17.0.14_7-jre-alpine
RUN apk add --no-cache curl && addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --from=build --chown=app:app /app/target/resumecraft.jar /app/resumecraft.jar
USER app
EXPOSE 8080
CMD ["java", "-jar", "/app/resumecraft.jar"]
