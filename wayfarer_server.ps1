# Wayfarer local server - Windows PowerShell only
# No PHP / Python / Node installation required.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Save = Join-Path $Root "save"
$PostsFile = Join-Path $Save "posts.json"
$Save3 = Join-Path $Root "save3"
$PostsFile3 = Join-Path $Save3 "posts3.json"
New-Item -ItemType Directory -Force -Path $Save | Out-Null
if (-not (Test-Path $PostsFile)) { Set-Content -Path $PostsFile -Value "[]" -Encoding UTF8 }
New-Item -ItemType Directory -Force -Path $Save3 | Out-Null
if (-not (Test-Path $PostsFile3)) { Set-Content -Path $PostsFile3 -Value "[]" -Encoding UTF8 }

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:8000/")
$listener.Start()

function Send-Bytes($ctx, [byte[]]$bytes, $status=200, $contentType="text/plain; charset=utf-8") {
    $ctx.Response.StatusCode=$status
    $ctx.Response.ContentType=$contentType
    $ctx.Response.ContentLength64=$bytes.Length
    $ctx.Response.Headers.Add("Access-Control-Allow-Origin","*")
    $ctx.Response.OutputStream.Write($bytes,0,$bytes.Length)
    $ctx.Response.OutputStream.Close()
}
function Send-Json($ctx, $obj, $status=200) {
    $json = $obj | ConvertTo-Json -Depth 20 -Compress
    Send-Bytes $ctx ([Text.Encoding]::UTF8.GetBytes($json)) $status "application/json; charset=utf-8"
}
function Read-BodyBytes($stream, $length) {
    $buf = New-Object byte[] $length
    $pos=0
    while($pos -lt $length) {
        $n=$stream.Read($buf,$pos,$length-$pos)
        if($n -le 0){break}
        $pos += $n
    }
    return $buf
}
function Index-OfBytes([byte[]]$hay,[byte[]]$needle,[int]$start=0) {
    for($i=$start; $i -le $hay.Length-$needle.Length; $i++){
        $ok=$true
        for($j=0;$j -lt $needle.Length;$j++){ if($hay[$i+$j] -ne $needle[$j]){$ok=$false;break} }
        if($ok){return $i}
    }
    return -1
}
function Parse-Multipart($ctx) {
    $ct=$ctx.Request.ContentType
    $m=[regex]::Match($ct,'boundary=(?:"([^"]+)"|([^;]+))')
    if(-not $m.Success){ throw "multipart boundary를 찾을 수 없습니다." }
    $boundary = if($m.Groups[1].Success){$m.Groups[1].Value}else{$m.Groups[2].Value.Trim()}
    $body=Read-BodyBytes $ctx.Request.InputStream $ctx.Request.ContentLength64
    $b=([Text.Encoding]::ASCII).GetBytes("--"+$boundary)
    $parts=@()
    $p=Index-OfBytes $body $b 0
    while($p -ge 0){
        $next=Index-OfBytes $body $b ($p+$b.Length)
        if($next -lt 0){break}
        $partStart=$p+$b.Length
        if($partStart+2 -le $body.Length -and $body[$partStart] -eq 13 -and $body[$partStart+1] -eq 10){$partStart+=2}
        $partEnd=$next-2
        if($partEnd -gt $partStart){
            $headerEnd=Index-OfBytes $body ([byte[]](13,10,13,10)) $partStart
            if($headerEnd -gt $partStart){
                $headers=[Text.Encoding]::UTF8.GetString($body,$partStart,$headerEnd-$partStart)
                $dataStart=$headerEnd+4
                $dataLen=$partEnd-$dataStart
                $cd=[regex]::Match($headers,'(?im)^Content-Disposition:\s*form-data;\s*name="([^"]+)"(?:;\s*filename="([^"]*)")?')
                $ctm=[regex]::Match($headers,'(?im)^Content-Type:\s*([^\r\n]+)')
                if($cd.Success){
                    $name=$cd.Groups[1].Value
                    $filename=$cd.Groups[2].Value
                    $data=New-Object byte[] $dataLen
                    [Array]::Copy($body,$dataStart,$data,0,$dataLen)
                    $parts += [pscustomobject]@{Name=$name;Filename=$filename;ContentType=if($ctm.Success){$ctm.Groups[1].Value.Trim()}else{"application/octet-stream"};Data=$data}
                }
            }
        }
        $p=$next
    }
    return $parts
}
function SafeName($name) {
    $n=[IO.Path]::GetFileName($name)
    if([string]::IsNullOrWhiteSpace($n)){return "file"}
    return $n
}
function Load-Posts {
    try { return @(Get-Content $PostsFile -Raw -Encoding UTF8 | ConvertFrom-Json) } catch { return @() }
}
function Save-Posts($posts) {
    ConvertTo-Json -InputObject @($posts) -Depth 20 | Set-Content $PostsFile -Encoding UTF8
}
function Load-Posts3 {
    try { return @(Get-Content $PostsFile3 -Raw -Encoding UTF8 | ConvertFrom-Json | Where-Object { $_ }) } catch { return @() }
}
function Save-Posts3($posts) {
    ConvertTo-Json -InputObject @($posts) -Depth 20 | Set-Content $PostsFile3 -Encoding UTF8
}
function Mime($ext) {
    switch($ext.ToLower()){
      ".html"{"text/html; charset=utf-8";break}
      ".css"{"text/css; charset=utf-8";break}
      ".js"{"application/javascript; charset=utf-8";break}
      ".json"{"application/json; charset=utf-8";break}
      ".jpg"{"image/jpeg";break}; ".jpeg"{"image/jpeg";break}; ".png"{"image/png";break}; ".gif"{"image/gif";break}; ".webp"{"image/webp";break}; ".svg"{"image/svg+xml";break}
      ".pdf"{"application/pdf";break}; ".zip"{"application/zip";break}
      ".txt"{"text/plain; charset=utf-8";break}; ".mp3"{"audio/mpeg";break}
      default{"application/octet-stream"}
    }
}

Write-Host "Wayfarer server running at http://127.0.0.1:8000/" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop."
try {
while($listener.IsListening){
  $ctx=$listener.GetContext()
  try {
    $method=$ctx.Request.HttpMethod
    $path=[Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)

    if($method -eq "OPTIONS"){
      $ctx.Response.StatusCode=204
      $ctx.Response.Headers.Add("Access-Control-Allow-Origin","*")
      $ctx.Response.Headers.Add("Access-Control-Allow-Methods","GET,POST,DELETE,OPTIONS")
      $ctx.Response.Headers.Add("Access-Control-Allow-Headers","Content-Type")
      $ctx.Response.Close(); continue
    }

    if($path -eq "/api" -and $method -eq "GET"){
      $action=$ctx.Request.QueryString["action"]
      if($action -eq "list"){ Send-Json $ctx @{ok=$true;posts=(Load-Posts)}; continue }
    }

    if($path -eq "/api3" -and $method -eq "GET"){
      $action=$ctx.Request.QueryString["action"]
      if($action -eq "list"){ Send-Json $ctx @{ok=$true;posts=(Load-Posts3)}; continue }
    }

    if($path -eq "/api" -and $method -eq "POST"){
      $action=$ctx.Request.QueryString["action"]
      if($action -eq "create"){
        $parts=Parse-Multipart $ctx
        $title=($parts|Where Name -eq "title"|Select -First 1).Data
        $content=($parts|Where Name -eq "content"|Select -First 1).Data
        $category=($parts|Where Name -eq "category"|Select -First 1).Data
        $date=($parts|Where Name -eq "date"|Select -First 1).Data
        $dec = { param($x) if($null -eq $x){""}else{[Text.Encoding]::UTF8.GetString($x)} }
        $title=&$dec $title; $content=&$dec $content; $category=&$dec $category; $date=&$dec $date
        $id=[guid]::NewGuid().ToString("N")
        $folder=Join-Path $Save $id
        New-Item -ItemType Directory -Force -Path $folder | Out-Null
        $files=@()
        foreach($part in ($parts|Where {$_.Name -eq "files[]" -and $_.Filename})){
          $original=SafeName $part.Filename
          $name=$original; $k=1
          while(Test-Path (Join-Path $folder $name)){
            $stem=[IO.Path]::GetFileNameWithoutExtension($original); $ext=[IO.Path]::GetExtension($original)
            $name="${stem}_$k$ext"; $k++
          }
          [IO.File]::WriteAllBytes((Join-Path $folder $name),$part.Data)
          $files += [pscustomobject]@{name=$name;originalName=$original;type=$part.ContentType;size=$part.Data.Length;url="/save/$id/$([Uri]::EscapeDataString($name))"}
        }
        $post=[pscustomobject]@{id=$id;category=$category;title=$title;content=$content;date=$date;createdAt=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds();files=@($files)}
        $posts=Load-Posts
        $posts=@($post)+@($posts)
        Save-Posts $posts
        Send-Json $ctx @{ok=$true;post=$post}; continue
      }
    }

    if($path -eq "/api3" -and $method -eq "POST"){
      $action=$ctx.Request.QueryString["action"]
      if($action -eq "create"){
        $parts=Parse-Multipart $ctx
        $title=($parts|Where Name -eq "title"|Select -First 1).Data
        $content=($parts|Where Name -eq "content"|Select -First 1).Data
        $category=($parts|Where Name -eq "category"|Select -First 1).Data
        $date=($parts|Where Name -eq "date"|Select -First 1).Data
        $dec = { param($x) if($null -eq $x){""}else{[Text.Encoding]::UTF8.GetString($x)} }
        $title=&$dec $title; $content=&$dec $content; $category=&$dec $category; $date=&$dec $date
        $id=[guid]::NewGuid().ToString("N")
        $folder=Join-Path $Save3 $id
        New-Item -ItemType Directory -Force -Path $folder | Out-Null
        $files=@()
        foreach($part in ($parts|Where {$_.Name -eq "files[]" -and $_.Filename})){
          $original=SafeName $part.Filename
          $name=$original; $k=1
          while(Test-Path (Join-Path $folder $name)){
            $stem=[IO.Path]::GetFileNameWithoutExtension($original); $ext=[IO.Path]::GetExtension($original)
            $name="${stem}_$k$ext"; $k++
          }
          [IO.File]::WriteAllBytes((Join-Path $folder $name),$part.Data)
          $files += [pscustomobject]@{name=$name;originalName=$original;type=$part.ContentType;size=$part.Data.Length;url="/save3/$id/$([Uri]::EscapeDataString($name))"}
        }
        $post=[pscustomobject]@{id=$id;category=$category;title=$title;content=$content;date=$date;createdAt=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds();files=@($files)}
        $posts=Load-Posts3
        $posts=@($post)+@($posts)
        Save-Posts3 $posts
        Send-Json $ctx @{ok=$true;post=$post}; continue
      }
    }

    if($path -eq "/api" -and $method -eq "POST"){
      $action=$ctx.Request.QueryString["action"]
      if($action -eq "update"){
        $parts=Parse-Multipart $ctx
        $decU = { param($x) if($null -eq $x){""}else{[Text.Encoding]::UTF8.GetString($x)} }
        $getF = { param($n) $pp=$parts|Where Name -eq $n|Select -First 1; if($pp){&$decU $pp.Data}else{""} }
        $uid=&$getF "id"
        $posts=Load-Posts
        $posts=@($posts|ForEach-Object { if($_.id -eq $uid){ $_.title=&$getF "title"; $_.content=&$getF "content"; $_.date=&$getF "date" }; $_ })
        Save-Posts $posts
        Send-Json $ctx @{ok=$true;id=$uid}; continue
      }
    }

    if($path -eq "/api3" -and $method -eq "POST"){
      $action=$ctx.Request.QueryString["action"]
      if($action -eq "update"){
        $parts=Parse-Multipart $ctx
        $decU3 = { param($x) if($null -eq $x){""}else{[Text.Encoding]::UTF8.GetString($x)} }
        $getF3 = { param($n) $pp=$parts|Where Name -eq $n|Select -First 1; if($pp){&$decU3 $pp.Data}else{""} }
        $uid=&$getF3 "id"
        $posts=Load-Posts3
        $posts=@($posts|ForEach-Object { if($_.id -eq $uid){ $_.title=&$getF3 "title"; $_.content=&$getF3 "content"; $_.date=&$getF3 "date" }; $_ })
        Save-Posts3 $posts
        Send-Json $ctx @{ok=$true;id=$uid}; continue
      }
    }

    if($path -eq "/api" -and $method -eq "POST" -and $ctx.Request.ContentType -like "application/json*"){
      # reserved
    }

    if($path -like "/api/*" -and $method -eq "POST"){
      $id=$path.Substring(5).Trim("/")
      $body=Read-BodyBytes $ctx.Request.InputStream $ctx.Request.ContentLength64
      $obj=[Text.Encoding]::UTF8.GetString($body)|ConvertFrom-Json
      if($id -and $obj.id){$id=$obj.id}
      $posts=Load-Posts
      $posts=@($posts|Where {$_.id -ne $id})
      Save-Posts $posts
      $folder=Join-Path $Save $id
      if(Test-Path $folder){Remove-Item $folder -Recurse -Force}
      Send-Json $ctx @{ok=$true;deleted=$true}; continue
    }

    if($path -like "/api3/*" -and $method -eq "POST"){
      $id=$path.Substring(6).Trim("/")
      $body=Read-BodyBytes $ctx.Request.InputStream $ctx.Request.ContentLength64
      $obj=[Text.Encoding]::UTF8.GetString($body)|ConvertFrom-Json
      if($id -and $obj.id){$id=$obj.id}
      $posts=Load-Posts3
      $posts=@($posts|Where {$_.id -ne $id})
      Save-Posts3 $posts
      $folder=Join-Path $Save3 $id
      if(Test-Path $folder){Remove-Item $folder -Recurse -Force}
      Send-Json $ctx @{ok=$true;deleted=$true}; continue
    }

    if($path -like "/save/*" -and $method -eq "GET"){
      $rel=$path.Substring(6).Replace("/","\")
      $full=[IO.Path]::GetFullPath((Join-Path $Save $rel))
      if(-not $full.StartsWith([IO.Path]::GetFullPath($Save),[StringComparison]::OrdinalIgnoreCase)){ Send-Bytes $ctx ([Text.Encoding]::UTF8.GetBytes("Forbidden")) 403; continue }
      if(Test-Path $full -PathType Leaf){
        $bytes=[IO.File]::ReadAllBytes($full); Send-Bytes $ctx $bytes 200 (Mime ([IO.Path]::GetExtension($full))); continue
      }
      Send-Bytes $ctx ([Text.Encoding]::UTF8.GetBytes("Not found")) 404; continue
    }

    if($path -like "/save3/*" -and $method -eq "GET"){
      $rel=$path.Substring(7).Replace("/","\")
      $full=[IO.Path]::GetFullPath((Join-Path $Save3 $rel))
      if(-not $full.StartsWith([IO.Path]::GetFullPath($Save3),[StringComparison]::OrdinalIgnoreCase)){ Send-Bytes $ctx ([Text.Encoding]::UTF8.GetBytes("Forbidden")) 403; continue }
      if(Test-Path $full -PathType Leaf){
        $bytes=[IO.File]::ReadAllBytes($full); Send-Bytes $ctx $bytes 200 (Mime ([IO.Path]::GetExtension($full))); continue
      }
      Send-Bytes $ctx ([Text.Encoding]::UTF8.GetBytes("Not found")) 404; continue
    }

    if($method -eq "GET"){
      $rel=$path.TrimStart("/")
      if([string]::IsNullOrWhiteSpace($rel)){$rel="index.html"}
      $full=[IO.Path]::GetFullPath((Join-Path $Root $rel))
      if(-not $full.StartsWith([IO.Path]::GetFullPath($Root),[StringComparison]::OrdinalIgnoreCase)){Send-Bytes $ctx ([Text.Encoding]::UTF8.GetBytes("Forbidden")) 403;continue}
      if(Test-Path $full -PathType Leaf){
        $bytes=[IO.File]::ReadAllBytes($full); Send-Bytes $ctx $bytes 200 (Mime ([IO.Path]::GetExtension($full)));continue
      }
    }
    Send-Bytes $ctx ([Text.Encoding]::UTF8.GetBytes("Not found")) 404
  } catch {
    try { Send-Json $ctx @{ok=$false;message=$_.Exception.Message} 500 } catch {}
  }
}
} finally { $listener.Stop(); $listener.Close() }
