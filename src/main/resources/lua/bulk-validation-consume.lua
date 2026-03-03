local json = redis.call('GET', KEYS[1])
if not json then
    return ''
end

local payload = cjson.decode(json)
if tostring(payload.loginId) ~= ARGV[1] or tostring(payload.teamId) ~= ARGV[2] or tostring(payload.setId) ~= ARGV[3] then
    return '__MISMATCH__'
end

if payload.saveConsumed == true then
    return '__CONSUMED__'
end

payload.saveConsumed = true
local ttlMs = redis.call('PTTL', KEYS[1])
if ttlMs and ttlMs > 0 then
    redis.call('PSETEX', KEYS[1], ttlMs, cjson.encode(payload))
else
    redis.call('PSETEX', KEYS[1], 600000, cjson.encode(payload))
end

return json
