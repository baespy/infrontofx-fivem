ESX = exports["es_extended"]:getSharedObject()
local scriptname = GetCurrentResourceName()

TelemetryServer = {
    ServerState = {
        running = true,
    },
}

function TelemetryServer:Run()
    while self.ServerState.running do
        FC.PublishStatus({
            players = GetNumPlayerIndices(),
            resources = GetNumResources(),
            timestamp = os.time(),
        })

        Wait(Config.General.interval_ms)
    end
end

CreateThread(function()
    TelemetryServer:Run()
end)

AddEventHandler("onResourceStop", function(resource)
    if resource ~= scriptname then
        return
    end

    TelemetryServer.ServerState.running = false
end)
