# Activa la verificación de identidad de Encárgalo en Supabase:
#   consultar-dni y validar-dni (RENIEC vía Decolecta) y verificar-identidad (AWS).
#
# Pide los secretos sin mostrarlos en pantalla y los guarda como secretos del
# proyecto en Supabase: no quedan en ningún archivo ni en el historial.
#
# Uso, desde esta carpeta, en una ventana de PowerShell:
#   powershell -ExecutionPolicy Bypass -File .\activar-verificacion.ps1
#
# Antes: aplicar 0009 y 0010 en el SQL Editor (README, pasos 6 y 6b).

$ErrorActionPreference = 'Stop'
$ref = 'ozwccisxfhawzsbrifyl'   # proyecto de Encárgalo (lo que va antes de .supabase.co)

function Leer-Secreto($texto) {
  $seguro = Read-Host -AsSecureString $texto
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($seguro)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr).Trim() }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

Write-Host "`n1/4  Iniciar sesión en Supabase (se abre el navegador)" -ForegroundColor Cyan
npx -y supabase login
if ($LASTEXITCODE) { throw 'No se pudo iniciar sesión en Supabase' }

Write-Host "`n2/4  Vincular el proyecto $ref" -ForegroundColor Cyan
npx -y supabase link --project-ref $ref
if ($LASTEXITCODE) { throw 'No se pudo vincular el proyecto' }

Write-Host "`n3/4  Secretos (no se muestran al escribir; Enter para dejar el que ya estaba)" -ForegroundColor Cyan
$decolecta = Leer-Secreto 'Token de Decolecta (decolecta.com/profile)'
$awsId     = Leer-Secreto 'AWS Access key ID'
$awsClave  = Leer-Secreto 'AWS Secret access key'

$pares = @()
if ($decolecta) { $pares += "DECOLECTA_TOKEN=$decolecta" }
if ($awsId)     { $pares += "AWS_ACCESS_KEY_ID=$awsId" }
if ($awsClave)  { $pares += "AWS_SECRET_ACCESS_KEY=$awsClave" }
$pares += 'AWS_REGION=us-east-1'
npx -y supabase secrets set @pares --project-ref $ref
if ($LASTEXITCODE) { throw 'No se pudieron guardar los secretos' }
Remove-Variable decolecta, awsId, awsClave, pares

Write-Host "`n4/4  Desplegar las tres funciones" -ForegroundColor Cyan
# consultar-dni se llama en el registro, antes de tener sesión: va sin verificar
# JWT. Se protege sola (límite por IP y caché por DNI).
npx -y supabase functions deploy consultar-dni --no-verify-jwt --project-ref $ref
if ($LASTEXITCODE) { throw 'Falló el despliegue de consultar-dni' }
foreach ($f in 'validar-dni', 'verificar-identidad') {
  npx -y supabase functions deploy $f --project-ref $ref
  if ($LASTEXITCODE) { throw "Falló el despliegue de $f" }
}

Write-Host "`nListo. Secretos guardados:" -ForegroundColor Green
npx -y supabase secrets list --project-ref $ref
