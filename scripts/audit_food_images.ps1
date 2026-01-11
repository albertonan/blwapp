param(
  [string]$FoodsPath = (Join-Path $PSScriptRoot '..\data\foods')
)

$foodsPathResolved = Resolve-Path $FoodsPath -ErrorAction Stop
$files = Get-ChildItem -Path $foodsPathResolved -Filter '*.json'

$results = @()
foreach($f in $files) {
  try {
    $json = Get-Content $f.FullName -Raw | ConvertFrom-Json
  } catch {
    $results += [pscustomobject]@{ file=$f.Name; issue='invalid json'; path=''; url='' }
    continue
  }

  if($null -eq $json.imagen_alimento) {
    $results += [pscustomobject]@{ file=$f.Name; issue='missing imagen_alimento'; path='imagen_alimento'; url='' }
  } elseif($json.imagen_alimento -match 'images\.unsplash\.com' -and $json.imagen_alimento -notmatch 'auto=format') {
    $results += [pscustomobject]@{ file=$f.Name; issue='unsplash missing auto'; path='imagen_alimento'; url=$json.imagen_alimento }
  }

  if($json.presentaciones) {
    for($i=0; $i -lt $json.presentaciones.Count; $i++) {
      $p = $json.presentaciones[$i]
      $title = if($p.titulo){ $p.titulo } else { "#${i}" }
      $pPath = "presentaciones[$i].imagen ($title)"

      if($null -eq $p.imagen) {
        $results += [pscustomobject]@{ file=$f.Name; issue='missing imagen'; path=$pPath; url='' }
      } elseif($p.imagen -match 'images\.unsplash\.com' -and $p.imagen -notmatch 'auto=format') {
        $results += [pscustomobject]@{ file=$f.Name; issue='unsplash missing auto'; path=$pPath; url=$p.imagen }
      }
    }
  }
}

$results | Sort-Object file, path | Format-Table -AutoSize

Write-Host "" 
Write-Host ("Total issues: {0}" -f $results.Count)
