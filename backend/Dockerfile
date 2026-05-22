FROM node:20-alpine

# Install bash for the entrypoint script
RUN apk add --no-cache bash

WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy application source code
COPY . .

# Ensure entrypoint is executable
RUN chmod +x docker-entrypoint.sh

# Expose port
EXPOSE 3000

# Set entrypoint and default command
ENTRYPOINT ["/usr/src/app/docker-entrypoint.sh"]
CMD ["npm", "start"]
