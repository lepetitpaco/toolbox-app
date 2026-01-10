FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Expose port
EXPOSE 3000

# For development, we'll use volumes from docker-compose
# So we don't copy the code here - it will be mounted
# This allows hot reload to work properly

CMD ["npm", "run", "dev"]
