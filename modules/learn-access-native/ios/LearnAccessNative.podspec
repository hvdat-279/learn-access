Pod::Spec.new do |s|
 s.name = 'LearnAccessNative'
 s.version = '1.0.0'
 s.summary = 'Offline OCR and PDF rendering for LearnAccess'
 s.description = 'Expo module using bundled ML Kit Latin OCR and PDFKit.'
 s.license = { :type => 'MIT' }
 s.author = 'LearningAccess'
 s.homepage = 'https://example.com/learnaccess'
 s.platforms = { :ios => '16.0' }
 s.source = { :path => '.' }
 s.static_framework = true
 s.dependency 'ExpoModulesCore'
 s.dependency 'GoogleMLKit/TextRecognition', '9.0.0'
 s.swift_version = '5.9'
 s.source_files = '**/*.{h,m,mm,swift}'
 s.frameworks = 'PDFKit', 'UIKit'
end
