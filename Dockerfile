FROM node:22-alpine

WORKDIR /usr/src/app

# Since we are zero dependency, we don't even need npm install!
# Just copy the source code directly
COPY . .

# Expose the application port
EXPOSE 3000

# Create a volume for the persistent data
VOLUME ["/usr/src/app/data"]

# Run the application with the env file mapping
CMD ["node", "--env-file=.env", "server.js"]
