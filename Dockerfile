# Use the official Node.js image
FROM node:20

# Create and set the working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package.json ./

# Install dependencies
RUN npm install

# Copy the rest of the project files
COPY . .

# Expose port for the web server (8080)
EXPOSE 8080

# Start the app
CMD ["node", "index.js"]
