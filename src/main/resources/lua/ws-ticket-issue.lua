local oldTicket = redis.call('GET', KEYS[3])
if oldTicket then
    redis.call('DEL', ARGV[5] .. oldTicket)
    redis.call('SREM', KEYS[2], oldTicket)
end

local members = redis.call('SMEMBERS', KEYS[2])
local count = 0
for _, ticket in ipairs(members) do
    if redis.call('EXISTS', ARGV[5] .. ticket) == 1 then
        count = count + 1
    else
        redis.call('SREM', KEYS[2], ticket)
    end
end

if count >= tonumber(ARGV[4]) then
    return 0
end

redis.call('SET', KEYS[1], ARGV[2], 'EX', tonumber(ARGV[3]))
redis.call('SADD', KEYS[2], ARGV[1])
redis.call('EXPIRE', KEYS[2], tonumber(ARGV[6]))
redis.call('SET', KEYS[3], ARGV[1], 'EX', tonumber(ARGV[3]))
return 1
