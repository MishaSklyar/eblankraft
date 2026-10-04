#!/bin/bash
set -e
cd "$(dirname "$0")/csharp"
dotnet run -c Release
