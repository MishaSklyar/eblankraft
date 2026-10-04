#!/bin/bash
set -e

echo "=== Building Eblankraft 2.0 (C# + Raylib) ==="
cd "$(dirname "$0")/csharp"

echo "Building Debug..."
dotnet build Eblankraft.csproj -c Debug

echo "Publishing Self-Contained Linux x64..."
dotnet publish Eblankraft.csproj -c Release -r linux-x64 --self-contained true -p:PublishSingleFile=true -o ../dist_csharp_linux

echo "Publishing Self-Contained Windows x64..."
dotnet publish Eblankraft.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o ../dist_csharp_windows

echo "Copying atlas.png to distribution directories..."
cp atlas.png ../dist_csharp_linux/
cp atlas.png ../dist_csharp_windows/

echo "=== Build Complete! ==="
echo "Linux Binary: dist_csharp_linux/eblankraft"
echo "Windows Binary: dist_csharp_windows/eblankraft.exe"
