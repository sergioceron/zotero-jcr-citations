Zotero.JCRCitations = {};


Zotero.JCRCitations.init = function() {
    Zotero.JCRCitations.resetState();

    stringBundle = document.getElementById('zoteroJCRCitations-bundle');
    Zotero.JCRCitations.captchaString = 'Please enter the Captcha on the page that will now open and then re-try updating the citations, or wait a while to get unblocked by Google if the Captcha is not present.';
    Zotero.JCRCitations.citedPrefixString = ''
    if (stringBundle != null) {
        Zotero.JCRCitations.captchaString = stringBundle.getString('captchaString');
    }

    // Register the callback in Zotero as an item observer
    var notifierID = Zotero.Notifier.registerObserver(
            Zotero.JCRCitations.notifierCallback, ['item']);

    // Unregister callback when the window closes (important to avoid a memory leak)
    window.addEventListener('unload', function(e) {
        Zotero.Notifier.unregisterObserver(notifierID);
    }, false);
};

Zotero.JCRCitations.notifierCallback = {
    notify: function(event, type, ids, extraData) {
                if (event == 'add') {
                    Zotero.JCRCitations.updateItems(Zotero.Items.get(ids));
                }
            }
};

Zotero.JCRCitations.resetState = function() {
    Zotero.JCRCitations.current = -1;
    Zotero.JCRCitations.toUpdate = 0;
    Zotero.JCRCitations.itemsToUpdate = null;
    Zotero.JCRCitations.numberOfUpdatedItems = 0;
};

Zotero.JCRCitations.updateSelectedEntity = function(libraryId) {
    if (!ZoteroPane.canEdit()) {
        ZoteroPane.displayCannotEditLibraryMessage();
        return;
    }

    var collection = ZoteroPane.getSelectedCollection();
    var group = ZoteroPane.getSelectedGroup();

    if (collection) {
        var items = [];
        var _items = collection.getChildren(true, false, 'item');
        for each(var item in _items) {
            items.push(Zotero.Items.get(item.id));
        }
        Zotero.JCRCitations.updateItems(items);
    } else if (group) {
        if (!group.editable) {
            alert("This group is not editable!");
            return;
        }
        var collections = group.getCollections();
        var items = [];
        for each(collection in collections) {
            var _items = collection.getChildren(true, false, 'item');
            for each(var item in _items) {
                items.push(Zotero.Items.get(item.id));
            }
        }
        Zotero.JCRCitations.updateItems(items);
    } else {
        Zotero.JCRCitations.updateAll();
    }
};

Zotero.JCRCitations.updateSelectedItems = function() {
    Zotero.JCRCitations.updateItems(ZoteroPane.getSelectedItems());
};

Zotero.JCRCitations.updateAll = function() {
    var items = [];
    var _items = Zotero.Items.getAll();
    for each(var item in _items) {
        if (item.isRegularItem() && !item.isCollection()) {
            var libraryId = item.getField('libraryID');
            if (libraryId == null ||
                    libraryId == '' ||
                    Zotero.Libraries.isEditable(libraryId)) {
                items.push(item);
            }
        }
    }
    Zotero.JCRCitations.updateItems(items);
};

Zotero.JCRCitations.updateItems = function(items) {
    if (items.length == 0 ||
            Zotero.JCRCitations.numberOfUpdatedItems < Zotero.JCRCitations.toUpdate) {
        return;
    }

    Zotero.JCRCitations.resetState();
    Zotero.JCRCitations.toUpdate = items.length;
    Zotero.JCRCitations.itemsToUpdate = items;
    Zotero.JCRCitations.updateNextItem();
};

Zotero.JCRCitations.updateNextItem = function() {
    Zotero.JCRCitations.numberOfUpdatedItems++;

    if (Zotero.JCRCitations.current == Zotero.JCRCitations.toUpdate - 1) {
        Zotero.JCRCitations.resetState();
        return;
    }

    Zotero.JCRCitations.current++;
    Zotero.JCRCitations.updateItem(
            Zotero.JCRCitations.itemsToUpdate[Zotero.JCRCitations.current]);
};

Zotero.JCRCitations.updateItem = function(item) {
    if (typeof item.attachmentHash !== 'undefined') {
        Zotero.JCRCitations.updateNextItem();
        return;
    }
    
    var issn = item.getField('ISSN') + '';
    if (issn == '') {
        issn = 'undefined';
    }

    url = "chrome://zoterojcrcitations/content/jcr.csv";
    
    var req = new XMLHttpRequest();
    req.open('GET', url, true);

    req.onreadystatechange = function() {
        if (req.readyState == 4) {
            if (req.status == 200) {
                if (item.isRegularItem() && !item.isCollection()) {
                    var issns = [];
                    if( issn.indexOf(',') == -1 ){
                        issns.push( issn.trim() );
                    } else {
                        values = issn.split(',');
                        for(i = 0; i < values.length; i++){
                            issns.push( values[i].trim() );
                        }
                    }
                    
                    var citations = '';
                    for( i = 0; i < issns.length; i++ ){
                        factor = Zotero.JCRCitations.getCitationCount( req.responseText, issns[i] );
                        citations += factor + '\n';
                    }
                    
                    try {
                        item.setField('extra', citations);
                        item.save();
                    } catch (e) {}
                }
                Zotero.JCRCitations.updateNextItem();
            }
        }
    };

    req.send(null);
};

Zotero.JCRCitations.getCitationCount = function(responseText, issn) {
    if (responseText == '') {
        return '';
    }
    
    if(issn.indexOf('-') == -1){
        issn = issn.substr(0, 4) + '-' + issn.substr(4, 4); 
    }

    var issnExists = responseText.search(issn);
    if (issnExists == -1) {
        return '-';
    }
    
    var tmpString = responseText.substr(issnExists + 10, 40);
    var start = tmpString.indexOf(',');
    var end = tmpString.indexOf(',', start + 1);
    
    return tmpString.substring(start + 1, end);
};

window.addEventListener('load', function(e) {
    Zotero.JCRCitations.init();
}, false);
