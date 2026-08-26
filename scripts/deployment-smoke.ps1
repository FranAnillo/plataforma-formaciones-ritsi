param(
    [string]$ProjectName = "ritsi-deploytest",
    [int]$BackendPort = 18000,
    [int]$FrontendPort = 13000,
    [int]$MongoPort = 27018,
    [switch]$KeepRunning
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Net.Http
$workspace = Split-Path -Parent $PSScriptRoot
$backendUrl = "http://127.0.0.1:$BackendPort"
$frontendUrl = "http://127.0.0.1:$FrontendPort"
$adminEmail = "deploy-admin@example.com"
$adminPassword = "Deploy-Test-Password-2026!"
$learnerPassword = "Learner-Test-Password-2026!"
$meetingUrl = "https://meet.google.com/deploy-smoke-test"

$env:MONGO_BIND_PORT = [string]$MongoPort
$env:BACKEND_BIND_PORT = [string]$BackendPort
$env:FRONTEND_BIND_PORT = [string]$FrontendPort
$env:VITE_BACKEND_URL = $backendUrl
$env:PUBLIC_API_URL = $backendUrl
$env:PUBLIC_APP_URL = $frontendUrl
$env:CORS_ORIGINS = $frontendUrl
$env:COOKIE_SECURE = "false"
$env:MEETING_URL_ENCRYPTION_KEY = "deployment-smoke-test-key-material-2026"
$env:AUTO_IMPORT_FORMATIONS = "false"
$env:AUTO_IMPORT_UNIVERSITIES = "false"
$env:TELEGRAM_BOT_TOKEN = ""
$env:TELEGRAM_BOT_USERNAME = ""
$env:TELEGRAM_WEBHOOK_SECRET = ""
$env:GOOGLE_CALENDAR_ID = ""
$env:GOOGLE_CLIENT_ID = ""
$env:GOOGLE_CLIENT_SECRET = ""
$env:GOOGLE_REFRESH_TOKEN = ""

function Invoke-Api {
    param(
        [string]$Method,
        [string]$Path,
        $Body,
        [Microsoft.PowerShell.Commands.WebRequestSession]$Session
    )
    $parameters = @{
        Method = $Method
        Uri = "$backendUrl/api$Path"
        ContentType = "application/json"
        Headers = @{ Origin = $frontendUrl }
    }
    if ($null -ne $Session) { $parameters.WebSession = $Session }
    if ($null -ne $Body) { $parameters.Body = ($Body | ConvertTo-Json -Depth 12 -Compress) }
    return Invoke-RestMethod @parameters
}

function Wait-ForNotification {
    param(
        [Microsoft.PowerShell.Commands.WebRequestSession]$Session,
        [string]$Type,
        [int]$MinimumCount = 1
    )
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        $items = Invoke-Api -Method Get -Path "/notifications" -Session $Session
        $matches = @($items.type | Where-Object { $_ -eq $Type })
        if ($matches.Count -ge $MinimumCount) { return $true }
        Start-Sleep -Milliseconds 500
    }
    throw "El worker no materializo $MinimumCount notificacion(es) $Type dentro del plazo"
}

$result = [ordered]@{
    containers_healthy = $false
    api_health = $false
    frontend = $false
    pwa = $false
    authentication = $false
    assignment = $false
    worker_notification = $false
    progress_notifications = $false
    same_day_notification = $false
    session_confidentiality = $false
    join_redirect = $false
    calendar_feed = $false
    persistence_after_restart = $false
    outbox_processed = $false
}

Push-Location $workspace
try {
    docker compose -p $ProjectName up --build -d --wait
    if ($LASTEXITCODE -ne 0) { throw "docker compose up fallo" }
    $result.containers_healthy = $true

    $health = Invoke-RestMethod -Uri "$backendUrl/api/health"
    if ($health.status -ne "ok" -or $health.database -ne "ok") { throw "Healthcheck API invalido" }
    $result.api_health = $true

    $frontResponse = Invoke-WebRequest -UseBasicParsing -Uri "$frontendUrl/"
    if ($frontResponse.StatusCode -ne 200 -or $frontResponse.Content -notmatch "RITSI") { throw "Frontend no disponible" }
    if ($frontResponse.Headers["X-Frame-Options"] -ne "DENY") { throw "Falta cabecera X-Frame-Options" }
    $result.frontend = $true
    $manifest = Invoke-RestMethod -Uri "$frontendUrl/manifest.webmanifest"
    $serviceWorker = Invoke-WebRequest -UseBasicParsing -Uri "$frontendUrl/sw.js"
    if ($manifest.display -ne "standalone" -or $serviceWorker.Content -notmatch "pathname\.startsWith\('/api/'\)") { throw "PWA invalida" }
    $result.pwa = $true

    docker compose -p $ProjectName exec -T backend python scripts/create_admin.py $adminEmail "Deploy Admin" $adminPassword
    if ($LASTEXITCODE -ne 0) { throw "No se pudo crear el administrador de prueba" }

    $adminSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
    Invoke-Api -Method Post -Path "/auth/login" -Body @{ email = $adminEmail; password = $adminPassword } -Session $adminSession | Out-Null
    $me = Invoke-Api -Method Get -Path "/auth/me" -Session $adminSession
    if ($me.user_type -ne "admin") { throw "Login administrativo invalido" }
    $result.authentication = $true

    $university = Invoke-Api -Method Post -Path "/universities" -Body @{ name = "Universidad Smoke Test"; zone = "I" } -Session $adminSession
    $learner = Invoke-Api -Method Post -Path "/users" -Body @{ name = "Learner Smoke"; email = "deploy-learner@example.com"; password = $learnerPassword; user_type = "representante"; university_id = $university.id } -Session $adminSession
    $content = Invoke-Api -Method Post -Path "/content" -Body @{
        title = "Formacion de despliegue"
        description = "Contenido efimero para validar el despliegue"
        is_public = $false
        files = @(@{ title = "Guia"; url = "https://example.test/guide"; file_type = "link" })
        quizzes = @(@{ title = "Control"; passing_percentage = 70; questions = @(@{ question_text = "Selecciona la respuesta"; question_type = "multiple_choice"; options = @("Incorrecta", "Correcta"); correct_answers = @(1) }) })
    } -Session $adminSession
    $assignment = Invoke-Api -Method Post -Path "/assignments" -Body @{ content_id = $content.id; user_ids = @($learner.id); assign_to_all_representatives = $false } -Session $adminSession
    if (-not $assignment.id) { throw "Asignacion no creada" }
    $result.assignment = $true

    $learnerSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
    Invoke-Api -Method Post -Path "/auth/login" -Body @{ email = "deploy-learner@example.com"; password = $learnerPassword } -Session $learnerSession | Out-Null
    $null = Wait-ForNotification -Session $learnerSession -Type "TrainingAssigned"
    $result.worker_notification = $true

    Invoke-Api -Method Post -Path "/progress/file-completed" -Body @{
        content_id = $content.id
        file_id = $content.files[0].id
    } -Session $learnerSession | Out-Null
    $null = Wait-ForNotification -Session $learnerSession -Type "TrainingStarted"
    $quizAnswers = @{}
    $quizAnswers[$content.quizzes[0].questions[0].id] = @(1)
    Invoke-Api -Method Post -Path "/progress/submit-quiz" -Body @{
        content_id = $content.id
        quiz_id = $content.quizzes[0].id
        answers = $quizAnswers
    } -Session $learnerSession | Out-Null
    $null = Wait-ForNotification -Session $learnerSession -Type "TrainingCompleted"
    $result.progress_notifications = $true

    $startsAt = [DateTimeOffset]::UtcNow.AddMinutes(2)
    $session = Invoke-Api -Method Post -Path "/sessions" -Body @{
        content_id = $content.id
        title = "Sesion smoke"
        description = "Validacion del acceso temporal"
        starts_at = $startsAt.ToString("o")
        ends_at = $startsAt.AddMinutes(30).ToString("o")
        timezone = "Europe/Madrid"
        participant_user_ids = @($learner.id)
        join_window_minutes = 15
        meeting_url = $meetingUrl
    } -Session $adminSession
    if (($session | ConvertTo-Json -Depth 10) -match "meet.google.com") { throw "La API expuso el enlace privado" }
    $result.session_confidentiality = $true
    $null = Wait-ForNotification -Session $learnerSession -Type "SessionScheduled" -MinimumCount 2
    $result.same_day_notification = $true

    $handler = [System.Net.Http.HttpClientHandler]::new()
    $handler.AllowAutoRedirect = $false
    $handler.CookieContainer = [System.Net.CookieContainer]::new()
    $sessionCookie = $learnerSession.Cookies.GetCookies([Uri]$backendUrl)["session_token"]
    $handler.CookieContainer.Add([Uri]$backendUrl, $sessionCookie)
    $client = [System.Net.Http.HttpClient]::new($handler)
    $joinResponse = $client.PostAsync("$backendUrl/api/sessions/$($session.id)/join", [System.Net.Http.StringContent]::new("")).GetAwaiter().GetResult()
    if ([int]$joinResponse.StatusCode -ne 303 -or $joinResponse.Headers.Location.AbsoluteUri -ne $meetingUrl) { throw "Redireccion de acceso invalida" }
    $client.Dispose()
    $handler.Dispose()
    $result.join_redirect = $true

    $calendar = Invoke-Api -Method Post -Path "/integrations/calendar/feed" -Body @{} -Session $learnerSession
    $ics = (Invoke-WebRequest -UseBasicParsing -Uri $calendar.url).Content
    if ($ics -notmatch "BEGIN:VCALENDAR" -or $ics -match "meet.google.com" -or $ics -notmatch "dashboard\?tab=sessions") { throw "Feed ICS invalido o con informacion privada" }
    $result.calendar_feed = $true

    docker compose -p $ProjectName restart backend worker
    if ($LASTEXITCODE -ne 0) { throw "No se pudieron reiniciar backend y worker" }
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        try { $null = Invoke-RestMethod -Uri "$backendUrl/api/health"; break } catch { Start-Sleep -Seconds 1 }
    }
    $persistedMe = Invoke-Api -Method Get -Path "/auth/me" -Session $learnerSession
    if ($persistedMe.id -ne $learner.id) { throw "La sesion no persistio tras el reinicio" }
    $result.persistence_after_restart = $true

    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        $operations = Invoke-Api -Method Get -Path "/operations/integrations" -Session $adminSession
        if ($operations.outbox.pending -eq 0 -and $operations.outbox.processing -eq 0) { break }
        Start-Sleep -Milliseconds 500
    }
    if ($operations.outbox.failed -ne 0 -or $operations.outbox.processed -lt 4) { throw "El outbox no termino sin errores" }
    $result.outbox_processed = $true

    [pscustomobject]$result | ConvertTo-Json
}
finally {
    if (-not $KeepRunning) {
        docker compose -p $ProjectName down --volumes --remove-orphans
    }
    Pop-Location
}
