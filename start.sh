#!/bin/bash

while true
do
    echo "Starting Discord bot..."
    node index.js
    echo "Bot crashed or stopped. Restarting in 3 seconds..."
    sleep 3
done


