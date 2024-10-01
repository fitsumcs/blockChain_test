# Use an official Node.js runtime as a parent image
FROM oven/bun:1

# Set the working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package.json ./
RUN bun install

# Copy the rest of the application
COPY ./src ./src

# Expose the application port
EXPOSE 3000

# Command to run the application
CMD ["bun", "run", "src/index.ts"]


