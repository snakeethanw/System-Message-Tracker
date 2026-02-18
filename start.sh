#!/bin/bash

while true
do
    echo "Starting bot..."
    node index.js
    echo "Bot crashed with exit code $?. Restarting in 3 seconds..."
    sleep 3
done
