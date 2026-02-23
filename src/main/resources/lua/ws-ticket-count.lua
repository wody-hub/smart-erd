local members = redis.call('SMEMBERS', KEYS[1])
local count = 0
for _, ticket in ipairs(members) do
    if redis.call('EXISTS', ARGV[1] .. ticket) == 1 then
        count = count + 1
    else
        redis.call('SREM', KEYS[1], ticket)
    end
end
return count
