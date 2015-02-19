var gui = require('nw.gui'),
	fs = require('fs'),
	path = require('path'),
	JaySchema = require('jayschema'),
	xml2js = require('xml2js'),
	parser = new xml2js.Parser(),
	builder = new xml2js.Builder(),
	x2js = new X2JS(),
	jsv = new JaySchema(),
	schema = require('../js/schema.json'),
	dispatcher = window.opener,
	playlist = gui.Window.get();

//Audio States	
var playing = false,
	seeking = false;

//Dialog Target
var fileTarget;

//KPL variables
var savePlaylistCallback,
	currentPlaylist,
	isSaved = true;

//Utility Functions---------------------------------------------------------------------------------------
function hasInvalidTimings(json){
	var errors = [];
	for(var lineNum = 1; lineNum <= json.song.lyrics.line.length; lineNum++){
		var line = json.song.lyrics.line[lineNum - 1];
		//Validate end attribute comes after start attribute
		if(line.$.start.toSeconds() > line.$.end.toSeconds()){
			errors.push("Line " + lineNum + ": end time: " + line.$.end + " should come after start time: " + line.$.start + ".");
		}
		//Validate overlay timing information
		if(line.highlight !== undefined){
			if($.isArray(line.highlight)){
				var last = 0;
				for(var i = 0; i < line.highlight.length; i++){
					console.log(i);
					//Validation of sequential timings
					if(line.highlight[i].$.start.toSeconds() < last){
						errors.push("Line " + lineNum + ": " + last + " should come after " + line.highlight[i].$.start + " in the hierarchy.");
					}
					if(line.highlight[i].$.end.toSeconds() < line.highlight[i].$.start.toSeconds()){
						errors.push("Line " + lineNum + ": 'end' attribute: " + line.highlight[i].$.end + " should come after 'start' attribute: " + line.highlight[i].$.start + ".");
					}
					last = line.highlight[i].$.end.toSeconds();
					
					//Validation of correlated timings with line timings
					if(line.highlight[i].$.start.toSeconds() < line.$.start.toSeconds() || line.highlight[i].$.end.toSeconds() > line.$.end.toSeconds()){
						errors.push("Line " + lineNum + ": highlight tag start and end times should be within the line appearance times.");
					}
				}
			}
			else{
				//Validation of sequential timings
				if(line.highlight.$.end.toSeconds() < line.highlight.$.start.toSeconds()){
					errors.push("Line " + lineNum + ": 'end' attribute: " + line.highlight.$.end + " should come after 'start' attribute: " + line.highlight.$.start + ".");
				}
				//Validation of correlated timings with line timings
				if(line.highlight.$.start.toSeconds() < line.$.start.toSeconds() || line.highlight.$.end.toSeconds() > line.$.end.toSeconds()){
					errors.push("Line " + lineNum + ": highlight tag start and end times should be within the line appearance times.");
				}
			}
		}
		lineNum++;
	}
	if(errors.length > 0){
		return errors;
	}
	return false;
};

function parseKLF(element){
	element = $(element);
	var path = element.attr('data-path');
	if(!fs.existsSync(path)){
		setError(element, 'File has been moved or deleted.');
		return false;
	}
	var contents = fs.readFileSync(path, 'utf-8');
	
	//Invalid path
	if(contents == undefined){
		//TODO: What scenario triggers this?
		setError(element, 'File has been moved or deleted!!');
		return false;
	}
	else{
		var errors, json;
		
		try{
			//Callback is synchronous
			parser.parseString(contents, function(err, data){
				json = data;
				test = json;
			});
			
			//XML could not be parsed
			if(json == null){
				setError(element, 'Invalid or corrupt Karaokyo lyric file.');
				return false;
			}
			
			//JSON Schema Validation
			else if((errors = jsv.validate(json, schema)).length > 0){
				setError(element, 'Invalid Karaokyo lyric file format.');
				errors.forEach(function(e){
					console.error(e.kind + ": '" + e.desc + "' at " + e.instanceContext);
				});
				return false;
			}
			
			//Timing inconsistency detection
			else if((errors = hasInvalidTimings(json))){
				setError(element, 'Timing inconsistency detected: ' + errors[0]);
				return false;
			}
			
			//Audio file extension check
			else{
				var extension = json.song.audio.split('.').pop();
				switch(extension){
					case 'mp3':
						setError(element, 'Due to liscensing concerns, we currently do not support mp3 files.');
						return false;
						break;
					case 'ogg':
					case 'oga':
					case 'wav':
						break;
					default:
						setError(element, 'Unrecognized audio filetype: ' + extension);
						return false;
				}
			}
			
			return json;
		}
		catch(e){
			//Unknown error
			setError(element, e.message)
			return false;
		}
	}
};

function setError(element, error){
	element = $(element);
	element
		.addClass('invalid')
		.removeClass('valid')
		.attr('title', error)
		.tooltip({
		  track: true
		})
		.tooltip('enable');
};

function addToPlaylist(filepath){
	var item = $('<div>');
	var filename = path.basename(filepath);
	var extension = filename.split('.').pop().toLowerCase();
	
	item.addClass('valid');
	
	switch(extension){
		case 'klf':
			item.attr('data-path', filepath)
				.addClass(extension)
				.append($('<span>' + filename.replace(/\.[^/.]+$/, "") + '</span>'));
			$('#playlist').append(item);
			isSaved = false;
			break;
		case 'mp3':
		case 'ogg':
		case 'oga':
		case 'wav':
			item.attr('data-path', filepath)
				.addClass(extension)
				.append($('<span>' + filename.replace(/\.[^/.]+$/, "") + '</span>'));
			$('#playlist').append(item);
			isSaved = false;
			break;
		default:
	}
};

function savePlaylist(arg){
	/*var content = '';
	$('#playlist div').each(function(index, file){
		content = content + $(file).attr('data-path') + ';';
	})*/
	var content = $('#playlist div').map(function(){
		return $(this).data('path');
	}).get().join(';');
	
	fs.writeFile(arg, content, function(err) {
		if(err){
			console.log(err);
			alert('There was a problem saving the playlist.');
		}
		else{
			isSaved = true;
		}
	});
};

function showSavePlaylistDialog(callback){
	//Used in 3 cases when current playlist is not saved
	// 1) Loading a playlist from the file menu
	// 2) Loading a playlist via command line
	// 3) Exiting the program
	savePlaylistCallback = callback;
	$("#dialog-save").dialog('open');
}

function play(element){
	element = $(element);
	
	//Reset
	dispatcher.clearOverlay();
	$('#audio').removeAttr('src');
	
	if(element.length != 0){
		$('#playlist div.playing').removeClass('playing');
		element.addClass('playing');
		
		if(element.hasClass('invalid')){
			playNext();
		}
		else{
			var path = element.attr('data-path');
			if(path){
				var extension = path.split('.').pop().toLowerCase();
				
				switch(extension){
					case 'klf':
						playKLF(path);
						break;
					case 'mp3':
						setError(element, 'Due to liscensing concerns, we currently do not support mp3 files.');
						break;
					case 'ogg':
					case 'oga':
					case 'wav':
						if(fs.existsSync(path)){
							dispatcher.clearOverlay();
							playlist.window.$('#audio').attr('src', path);
						}
						else{
							setError(element, 'File has been moved or deleted.');
						}
						break;
					default:
						//Unrecognized extension, or is a directory
						setError(element, 'Karaokyo cannot play this filetype');
				}
			}
			else{
				//No path error
				setError(element, 'Karaokyo cannot play this filetype');
			}
		}
	}
};

function playNext(){
	if($('#playlist div.playing').length == 0){
		play($('#playlist div.valid').first());
	}
	else{
		if($('#playlist div.playing').next().length == 0){
			//Loop to first
			play($('#playlist div.valid').first());
		}
		else{
			play($('#playlist div.playing').next());
		}
	}
};

function playKLF(path){
	fs.readFile(path, 'utf-8', function(error, contents){
		if(error){
			switch(error.code){
				case 'ENOENT':
					setError($('#playlist div.playing'), 'File not found.');
					break;
				default:
					setError($('#playlist div.playing'), 'An error has occured while opening the file.');
					break;
			}
		}
		else{
			var json;
			
			//Read and parse file
			if((json = parseKLF($('#playlist div.playing'))) === false){
				//If error, play next
				playNext();
			}
			//Format the overlay window
			else{
				console.log(json);
				dispatcher.initializeSong(json);
			}
		}
	});
};

function clearPlaylist(){
	$('#playlist').html('');
	$('#audio').attr('src', '');
}

function loadPlaylist(path){
	fs.readFile(path, 'utf-8', function(error, contents){
		if(!error){
			clearPlaylist();
			currentPlaylist = path;
			var paths = contents.split(';');
			paths.forEach(function(path){
				addToPlaylist(path);
			});
			playNext();
      isSaved = true;
		}
	});
}

function containsPlaylist(args){
	for(var i = 0; i < args.length; i++){
		if(args[i].split('.').pop() === 'kpl'){
			return i;
		}
		return false;
	}
}

function doExit(){
	if(!isSaved){
		playlist.show();
		playlist.focus();
		playlist.requestAttention(3);
		showSavePlaylistDialog(function(){
			dispatcher.exit();
		});
	}
	else{
		dispatcher.exit();
	}
}
//--End Utility Functions-----------------------------------------------------------------------------------

playlist.height = window.screen.availHeight * 0.7;
playlist.moveTo(window.screen.availWidth - playlist.width, 0);

//Playlist Window File Menu Setup
var playlistMenu = new gui.Menu({type: 'menubar'});
playlistMenu.append(new gui.MenuItem({
	label: 'File',
	submenu: new gui.Menu()
}));
playlistMenu.append(new gui.MenuItem({
	label: 'Open Source Licenses',
	click: function(){
    dispatcher.showOpenSource();
  }
}));

playlistMenu.items[0].submenu.append(new gui.MenuItem({
	label: 'Add to Playlist...',
	key: 'o',
	modifiers: 'ctrl',
	click: function(){
		playlist.window.$('#open').trigger('click');
	}
}));
playlistMenu.items[0].submenu.append(new gui.MenuItem({
	type: 'separator'
}));
playlistMenu.items[0].submenu.append(new gui.MenuItem({
	label: 'Load Playlist...',
	key: 'l',
	modifiers: 'ctrl',
	click: function(){
		if(isSaved){
			playlist.window.$('#loadPlaylist').trigger('click');
		}
		else{
			showSavePlaylistDialog(function(){
				playlist.window.$('#loadPlaylist').trigger('click');
			});
		}
	}
}));
playlistMenu.items[0].submenu.append(new gui.MenuItem({
	label: 'Save Playlist',
	key: 's',
	modifiers: 'ctrl',
	click: function(){
		if(currentPlaylist){
			savePlaylist(currentPlaylist);
		}
		else{
			playlist.window.$('#savePlaylist').trigger('click');
		}
	}
}));
playlistMenu.items[0].submenu.append(new gui.MenuItem({
	label: 'Save Playlist As...',
	key: 's',
	modifiers: 'ctrl-alt',
	click: function(){
		playlist.window.$('#savePlaylist').trigger('click');
	}
}));
playlistMenu.items[0].submenu.append(new gui.MenuItem({
	type: 'separator'
}));
playlistMenu.items[0].submenu.append(new gui.MenuItem({
	label: 'Options',
	click: function(){
		dispatcher.showOptions();
	}
}));
playlistMenu.items[0].submenu.append(new gui.MenuItem({
	type: 'separator'
}));
playlistMenu.items[0].submenu.append(new gui.MenuItem({
	label: 'Exit',
	click: function(){
		doExit();
	}
}));
playlist.menu = playlistMenu;

$(function(){
	var playlist = $('#playlist'),
		audio = $('#audio');
	
	//Load command line arguments
	if(gui.App.argv.length > 0){
		var index;
		//Check for .kpl
		if((index = containsPlaylist(gui.App.argv)) !== false){
			loadPlaylist(gui.App.argv[index]);
		}
		else{
			gui.App.argv.forEach(function(path){
				addToPlaylist(path);
			});
		}
	}
	
	//Drag and drop file functionality
	window.ondragover = function(e) { e.preventDefault(); return false };
	window.ondrop = function(e) { e.preventDefault(); return false };
	$('html').on('drop', function(e){
		if(e.originalEvent.dataTransfer){
			if(e.originalEvent.dataTransfer.files.length) {
				var files = e.originalEvent.dataTransfer.files
				e.preventDefault();
				console.log(files);
				for(var i = 0; i < files.length; i++){
					addToPlaylist(files[i].path);
				}
			}   
		}
	});
	
	//Context Menu Creation
	var retargetMenu = new gui.Menu();
	retargetMenu.append(new gui.MenuItem({
		label: 'Retarget Audio File',
		click: function(){
			$('#retarget').trigger('click');
		}
	}));
	
	//Dialogs
	$("#dialog-save").dialog({
		autoOpen: false,
		resizable: false,
		width: 250,
		modal: true,
		buttons: {
			"Yes": function() {
				$(this).dialog( "close" );
				if(currentPlaylist){
					savePlaylist(currentPlaylist);
					savePlaylistCallback();
				}
				else{
					$('#savePlaylistWithCallback').trigger('click');
				}
			},
			"No": function() {
				$(this).dialog( "close" );
				savePlaylistCallback();
			},
			Cancel: function() {
				$(this).dialog( "close" );
			}
		}
	});
	
	//Drag and drop reordering
	playlist.sortable();
	
	//Playlist item events
	//Keypress
	window.onkeydown = function(e){
		switch(e.keyCode){
			//ENTER
			case 13:
				if($('#playlist div.selected').length > 0){
					play($('#playlist div.selected').eq(0));
				}
				break;
			//DELETE
			case 46:
				//Check if item being removed is currently playing
				if($('#playlist div.selected.playing').length !== 0){
					//Reset
					dispatcher.clearOverlay();
					$('#audio').removeAttr('src');
					//Locate and play next in list
					var index = $('#playlist div.selected.playing').index();
					console.log(index);
					for(var i = index + 1; i != index; i++){
						if(i == $('#playlist div').length){
							i = -1;
						}
						else{
							if(!$('#playlist div').eq(i).hasClass('selected')){
								play($('#playlist div').eq(i));
								break;
							}
						}
					}
				}
				//Remove selected
				if($('#playlist div.selected').length > 0){
					$('#playlist div.selected').remove();
					isSaved = false;
				}
				break;
		}
	};
	
	//Selection logic
	playlist.delegate('div', 'click', function(e){
		if(e.ctrlKey){
			$(this).toggleClass('selected');
		}
		else if(e.shiftKey){
			var index = $(this).index(),
				firstIndex = $('#playlist div.selected').first().index();
			
			if(firstIndex === -1){
				$(this).addClass('selected');
			}
			else if(index < firstIndex){
				$('#playlist div.selected').removeClass('selected');
				$('#playlist div').slice(index, firstIndex + 1).addClass('selected');
				
			}
			else if(index > firstIndex){
				$('#playlist div.selected').removeClass('selected');
				$('#playlist div').slice(firstIndex, index + 1).addClass('selected');
			}
		}
		else{
			if($(this).hasClass('selected')){
				$('#playlist div.selected').removeClass('selected');
			}
			else{
				$('#playlist div.selected').removeClass('selected');
				$(this).addClass('selected');
			}
		}
	});
	
	//Play selection on double click
	playlist.delegate('div', 'dblclick', function(e){
		e.preventDefault();
		e.stopPropagation();
		//Clear any existing error
		if($(this).hasClass('invalid')){
			$(this)
				.addClass('valid')
				.removeClass('invalid')
				.tooltip('disable')
				.attr('title', '');
		}
		play(this);
	});
	
	//Context menu appearance
	playlist.delegate('div', 'contextmenu', function(e){
		e.preventDefault();
		fileTarget = this;
		retargetMenu.popup(e.pageX, e.pageY);
		return false;
	});
	
	//Open
	$('#open').change(function(e){
		this.value.replace(/\\/g, '/').split(';').forEach(function(path){
			addToPlaylist(path);
		});
		$('#open').val('');
	});
	
	//Retarget
	$('#retarget').change(function(e){
		var audioFile = this.value.replace(/\\/g, '/');
		if(audioFile){
			fs.readFile(fileTarget.getAttribute('data-path'), 'utf-8', function(err, contents){
				if(err){}
				else{
					parser.parseString(contents, function(err, json){
						if(json.song){
							json.song.audio = audioFile;
							fs.writeFile(fileTarget.getAttribute('data-path'), builder.buildObject(json), function(err){
								if(err){
									alert(err);
								}
								parseKLF(fileTarget);
							});
						}
					});
				}
			});
		}
		$('#retarget').val('');
	});
	
	//Load Playlist
	$('#loadPlaylist').change(function(e){
		loadPlaylist(this.value);
		$('#loadPlaylist').val('');
	});
	
	//Save Playlist
	$('#savePlaylist').change(function(e){
		savePlaylist(this.value);
		$('#savePlaylist').val('');
	});
	
	$('#savePlaylistWithCallback').change(function(e){
		savePlaylist(this.value);
		savePlaylistCallback();
		$('#savePlaylist').val('');
	});
	
	//Audio Events
	audio.on('seeking', function(){
		console.log('seeking');
		seeking = true;
	});
	audio.on('seeked', function(){
		console.log('seeked');
		seeking = false;
	});
	audio.on('pause', function(){
		console.log('pause');
		playing = false;
		dispatcher.doPause();
	});
	audio.on('play', function(){
		console.log('play');
		playing = true;
	});
	audio.on('ended', function(){
		console.log('ended');
		playing = false;
		playNext();
	});
	audio.on('error', function(){
		console.log('error');
		setError($('#playlist div.playing'), 'A playback error has occured.');
		playNext();
	});
	audio.bind('timeupdate', function(){
		dispatcher.doTimeUpdate();
	});
});