//Design name: staticcontent
//View name: staticcontent

function (doc, meta) {
  if (doc.JsonType == 'StaticContent') {
      emit(
        'appKey:' + doc.AppKey.toLowerCase() + '::module:' + doc.Module.toLowerCase(), 
        doc
      );
  }
}