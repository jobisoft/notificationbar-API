require 'json'

HANDLEBARS_VERSION = '4.7.6'

CONTENTS = FileList[
  'manifest.json',
  'background.js',
  'handlebars.js',
  'alert.html',
  'alert.js',
]

VERSION = JSON.load(File.read 'manifest.json')['version']
EXT_FILENAME = "templates-#{VERSION}.xpi"

require 'open-uri'

task 'handlebars.js' do |t|
  File.write(
    t.name,
    open("https://cdnjs.cloudflare.com/ajax/libs/handlebars.js/#{HANDLEBARS_VERSION}/handlebars.js").read
  )
end

file EXT_FILENAME => CONTENTS do |t|
  File.delete t.name if File.exist? t.name
  system "zip -r #{t.name} #{CONTENTS.join " "}"
end

task default: EXT_FILENAME
