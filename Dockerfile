# Use an official Node.js runtime as a parent image
FROM node:14-slim

# Set the working directory in the container to /app
WORKDIR /app

# Add the current directory contents into the container at /app
COPY . /app

# Install any needed packages specified in package.json
RUN npm install

# Make port 443 available to the world outside this container
EXPOSE 443

# Run main.js when the container launches
CMD ["node", "main.js"]