
  URL="https://safetysos-api.onrender.com/"
  TOKEN="my-demo-2026"
 
 echo "=========================================="
 echo "🚀 Measuring Connection & Firing Ping..."
 echo "=========================================="

 # 1. Capture exact client-side metrics using curl --write
 METRICS=$(curl -s -o /dev/null -w "%{time_connect} %{time

 # Extract metrics into individual variables
 TIME_CONNECT=$(echo $METRICS | awk '{print $1}')
 TIME_APPCONNECT=$(echo $METRICS | awk '{print $2}')
 TIME_TOTAL=$(echo $METRICS | awk '{print $3}')

 # Convert to milliseconds for clean, readable output (e.g
 TCP_MS=$(awk "BEGIN {print $TIME_CONNECT * 1000}")
 TLS_MS=$(awk "BEGIN {print $TIME_APPCONNECT * 1000}")
 TOTAL_MS=$(awk "BEGIN {print $TIME_TOTAL * 1000}")

 # 2. Fire request carrying actual numeric values in heade
 curl -s -i \
  -H "X-Presentation-Token: $TOKEN" \
  -H "X-Client-TCP-Connect: ${TCP_MS}ms" \   -H "X-Client-TLS-Handshake: ${TLS_MS}ms" \
   -H "X-Client-Total-Time: ${TOTAL_MS}ms" \
  "$URL"

echo -e "\n\n📊 [CLIENT METRICS]"
 echo "TCP Connect    : ${TCP_MS}ms"
echo "TLS Handshake  : ${TLS_MS}ms"
 echo "Total Latency  : ${TOTAL_MS}ms"






