#!/bin/bash
# Script to install Firebase dependencies for the Slyde game

echo "Installing Firebase dependencies..."

# Install Firebase package
npm install firebase

echo "Firebase installation complete!"
echo ""
echo "Next steps:"
echo "1. Update the measurementId in src/firebase/config.ts with your Firebase Analytics measurement ID"
echo "2. Test the implementation by running the app"
echo "3. Verify events are being tracked in Firebase Console"