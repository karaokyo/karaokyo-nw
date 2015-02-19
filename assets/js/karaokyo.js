var gui = require('nw.gui'),
	fs = require('fs'),
	parseArgs = require('minimist');
	
var test;

// Window References
var dispatcher = gui.Window.get(),
	options = gui.Window.open('options.html', {
		'icon': 'assets/img/karaokyo-64x64.png',
		'show': false,
		'frame': true,
		'toolbar': false,
		'show_in_taskbar': true,
		'width': 300,
		'min_width': 300,
		'min_height': 250
	}),
  opensource = gui.Window.open('opensource.html', {
		'icon': 'assets/img/karaokyo-64x64.png',
		'show': false,
		'frame': true,
		'toolbar': false,
		'position': "center",
		'resizable': false,
		'show_in_taskbar': true,
    'width': 300,
		'height': 250
	}),
	playlist = gui.Window.open('playlist.html', {
		'icon': 'assets/img/karaokyo-64x64.png',
		'show': false,
		'frame': true,
		'toolbar': false,
		'show_in_taskbar': true,
		'width': 300,
		'min_width': 300,
		'min_height': 250
	}),
	chrome = gui.Window.open('chrome.html', {
		'icon': 'assets/img/karaokyo-64x64.png',
		'show': false,
		'frame': true,
		'toolbar': false,
    'resizable': false,
		'show_in_taskbar': true,
		'min_width': 600,
		'min_height': 250
	}),
	overlay = gui.Window.open('overlay.html', {
		'icon': 'assets/img/karaokyo-64x64.png',
		'show': true,
		'frame': false,
		'toolbar': false,
		'position': "center",
		'resizable': false,
		'show_in_taskbar': false,
		'always-on-top': true,
		'transparent': true,
    'min_width': 600,
		'min_height': 250
	});

//Repaint Variables
var lyricData,
	isOverlayShowing = true,
	isRepainting = false;

//Handlebar Templates
var template_line,
	template_timed;
$(function(){
	template_line = Handlebars.compile($("#template_line").html());
	template_timed = Handlebars.compile($("#template_timed").html());
	Handlebars.registerHelper('timed', function(items, options){
		var out = "",
            text = "";
		
		//Multiple Items
		if($.isArray(items)){
			for(var i=0; i<items.length; i++){
				out = out + options.fn(items[i]);
				text = text + items[i]._;
			}
		}
		//Single Item
		else{
			out = options.fn(items);
			text = items._;
		}
		
		return out;
	});
});

//Utility Functions
function debounce(func, wait, immediate){
	var timeout;
	return function() {
		var context = this, args = arguments;
		var later = function() {
			timeout = null;
			if (!immediate) {
				func.apply(context, args);
			}
		};
		if (immediate && !timeout) {
			func.apply(context, args);
		}
		
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
	};
};

function calculateWidthOf(html){
	var item = $(html).clone();
    item.css({'position':'absolute','white-space':'nowrap','display':'block','visibility':'hidden'}).appendTo(overlay.window.$('body'));
	var width = item.width();
	item.remove();
	
	return width;
};

function initializeSong(json){
	if(fs.existsSync(json.song.audio)){
		playlist.window.$('#audio').attr('src', json.song.audio);
		generateLyricsHTML(json);
	}
	else{
		playlist.window.setError('#playlist div.playing', 'Audio file not found, please retarget.');
		playlist.window.playNext();
	}
};

function generateLyricsHTML(json){
  try{
    var overlayWidth = overlay.window.innerWidth;
    
    //Clear Lyrics
    clearOverlay();
    
    //Save Lyrics for Repainting
    lyricData = json;
    
    //Song Name and Artist Display
    overlay.window.$('#title').text(json.song.title);
    overlay.window.$('#artist').text(json.song.artist);
    
    //Generate Lyrics HTML
    var lines = json.song.lyrics.line;
    if(!$.isArray(lines)){
      lines = [lines];
    }
    lines.forEach(function(line){
      console.log(line);
      if(line._ != undefined)
      {
        overlay.window.$('#lyrics').append(template_line(line));
        console.log(template_line(line));
      }
      else{
        var generatedHTML = template_timed(line);
        console.log(generatedHTML);
        
        //Child spans
        var spans = $(generatedHTML).children(),
                  empty = $(generatedHTML).empty(),
                  sIndex = 0,
                  testLine, newLine, width;
        
        while(sIndex < spans.length){
          testLine = empty.clone().append(spans[sIndex]);
          newLine = empty.clone();
          
          //Add spans until an overflow occurs
          for(;sIndex < spans.length; sIndex++){
            testLine.append(spans[sIndex]);
            width = calculateWidthOf(testLine);
            if(width > overlayWidth){
              break;
            }
            $(spans[sIndex]).attr("data-width", width);
            newLine.append($(spans[sIndex]).clone());
          }
          
          //If we have not processed all the spans, then there is an overflow
          //The sIndex value at this point gives us the overflowing span
          //Now go word by word; calculating timing and width becomes necessary now
          if(sIndex < spans.length){
            var start = spans[sIndex].getAttribute("data-start").toSeconds();
            var end = spans[sIndex].getAttribute("data-end").toSeconds();
            var breakPoint;
            var words = spans[sIndex].innerHTML.split(" ");
            var wIndex = 0;
            
            if(words.length > 0){
              var text = words[0];
              if(text == "" && words.length > 1){
                text = " " + words[1];
                wIndex++;
              }
              
              //Calculate the width of the first word
              var width = calculateWidthOf(empty.clone().append($("<span>"+text+"</span>")));
              
              //Calculate the width of the whole span
              var fullWidth = calculateWidthOf(empty.clone().append(spans[sIndex]));
              
              //Check if the first word overflows
              if(calculateWidthOf(newLine.clone().append($("<span>"+text+"</span>"))) > overlayWidth){
                //Check if we are on a blank line
                if(calculateWidthOf(newLine.clone()) == calculateWidthOf(empty.clone())){
                  //If so, we are out of options, add the word anyway
                  breakPoint = (end - start) * (width/fullWidth) + start;
                  var span = $("<span>");
                  
                  span.attr("data-start", start.toTimeCode());
                  span.attr("data-end", breakPoint.toTimeCode());
                  span.attr("data-width", width);
                  span.text(text);
                  
                  newLine.append(span);
                  wIndex++;
                }
              }
              //Add words until an overflow occurs
              else{
                var testText = text;
                wIndex++;
                
                for(; wIndex < words.length; wIndex++){
                  testText = testText + " " + words[wIndex];
                  if(testText.trim() && calculateWidthOf(newLine.clone().append($("<span>"+testText+"</span>"))) > overlayWidth){
                    break;
                  }
                  text = testText;
                }
                
                width = calculateWidthOf(empty.clone().append($("<span>"+text+"</span>")));
                breakPoint = (end - start) * (width/fullWidth) + start;
                
                var span = $("<span>");
                span.attr("data-start", start.toTimeCode());
                span.attr("data-end", breakPoint.toTimeCode());
                span.attr("data-width", calculateWidthOf(newLine.clone().append($("<span>"+text+"</span>"))));
                span.text(text);
                
                newLine.append(span);
              }
              
              //Splice in the 2nd part of the overflowing span into the spans array
              if(breakPoint){
                text = ""
                for(; wIndex < words.length; wIndex++){
                  text = text + " " + words[wIndex];
                }
                var span = $("<span>");
                span.attr("data-start", breakPoint.toTimeCode());
                span.attr("data-end", end.toTimeCode());
                span.text(text);
                
                spans.splice(sIndex + 1, 0, span[0]);
                sIndex++;
              }
            }
          }
          
          //Create tracking div
          newLine.append('<div class="over">' + newLine[0].textContent + '</div>');
          //Add to the overlay
          overlay.window.$('#lyrics').append(newLine);
          console.log(newLine[0].innerHTML);
        }
      }
    });
  }
  catch(e){
    playlist.window.setError('#playlist div.playing', 'Lyrics could not be rendered.');
    clearOverlay();
  }
};

function clearOverlay(){
	overlay.window.$('#title').html('');
	overlay.window.$('#artist').html('');
	overlay.window.$('#lyrics').html('');
	lyricData = '';
}

function exit(){
	overlay.hide();
	chrome.hide();
	playlist.hide();
	options.hide();
  opensource.hide();
	gui.App.quit();
};

var repaint = debounce(function(){
	if(lyricData && isOverlayShowing && !isRepainting){
		var currentTime;
		console.log("repaint");
		isRepainting = true;
		generateLyricsHTML(lyricData);
		isRepainting = false;
		doTimeUpdate();
	}
}, 1000);

function doTimeUpdate(){
	if(isOverlayShowing && !isRepainting){
		console.log("time update");
		var currentTime = playlist.window.$('#audio').get(0).currentTime;
		
		//If the song just started playing, show title and artist
		if(currentTime < 1 && overlay.window.$('#title').css('opacity') == 0 && !playlist.window.seeking){
			overlay.window.$('#title').animate({opacity: 1}, 2000, function(){
				overlay.window.$('#title').delay(1500).animate({opacity: 0}, 2000);
			});
			overlay.window.$('#artist').delay(1000).animate({opacity: 1}, 2000, function(){
				overlay.window.$('#artist').animate({opacity: 0}, 2000);
			});
		}
		
		//Backup fade out for pause/seek/etc. scenarios
		if(currentTime > 5){
			if(overlay.window.$('#title').css('opacity') > 0 || overlay.window.$('#artist').css('opacity') > 0){
				overlay.window.$('#title').stop(true).animate({opacity: 0}, overlay.window.$('#title').css('opacity') * 2000);
				overlay.window.$('#artist').stop(true).animate({opacity: 0}, overlay.window.$('#artist').css('opacity') * 2000);
			}
		}
		overlay.window.$('div.line').each(function(){
			if($(this).attr('data-start').toSeconds() <= currentTime && $(this).attr('data-end').toSeconds() >= currentTime){
				$(this).addClass('active');
                var spans = $(this).find('span');
                if(spans.length > 0){
                    for(var i = 0; i < spans.length; i++){
                        if(spans[i].getAttribute('data-start').toSeconds() >= currentTime){
                            if(i == 0){
                                $(this).find('div.over').width(0);
                            }
                            else{
                                $(this).find('div.over').width(parseInt(spans[i-1].getAttribute('data-width')));
                            }
                            break;
                        }
                        else if(spans[i].getAttribute('data-end').toSeconds() <= currentTime){
                            if(i == spans.length - 1){
                                $(this).find('div.over').width(parseInt(spans[i].getAttribute('data-width')));
                            }
                        }
                        else{
                            var width = 0;
                            if(i > 0){
                                width = parseInt(spans[i - 1].getAttribute('data-width'));
                            }
                            var start = spans[i].getAttribute('data-start').toSeconds();
                            var end = spans[i].getAttribute('data-end').toSeconds();
                            var nextWidth = (parseInt(spans[i].getAttribute('data-width')));
                            var over = overlay.window.$(this).find('div.over');
                            width = width + (nextWidth - width) * ((currentTime - start)/(end - start));
                            
                            if(playlist.window.playing){
                                var duration = (spans[i].getAttribute('data-end').toSeconds() - currentTime) * 1000;
                                overlay.window.$(this).find('div.over').stop().animate({'width': nextWidth}, duration, 'linear');
                            }
                            else{
                                over.width(width);
                            }
                            break;
                        }
                    }
                }
			}
			else{
				$(this).removeClass('active');
				$(this).find('div.over').width(0);
			}
		});
	}
}

function doPause(){
	console.log("pause");
	overlay.window.$('div.over').filter(':visible').stop(true);
}

function showOptions(){
	options.show();
	options.focus();
}

function showOpenSource(){
  opensource.show();
  opensource.focus();
}

// Frame Variables
var trim = (dispatcher.width - dispatcher.window.innerWidth) / 2;
var titlebar = dispatcher.height - dispatcher.window.innerHeight - trim;

// Setup Menu
var menu = new gui.Menu();

//Show Window Chrome
var chromeMenuItem = new gui.MenuItem({
	type: 'checkbox',
	label: 'Show Window Chrome',
	click: function(){
		if(this.checked){
            chrome.x = overlay.x - trim;
            chrome.y = overlay.y - titlebar;
            chrome.width = overlay.width + trim * 2;
            chrome.height = overlay.height + titlebar + trim;
			chrome.show();
			chrome.focus();
		}
		else{
			chrome.hide();
		}
	}
});

menu.append(chromeMenuItem);

//Show Playlist
var playlistMenuItem = new gui.MenuItem({
	type: 'checkbox',
	label: 'Show Playlist',
	click: function(){
		if(this.checked){
			playlist.show();
			playlist.focus();
		}
		else{
			playlist.hide();
		}
	}
});

menu.append(playlistMenuItem);

//Always On Top
menu.append(new gui.MenuItem({
	type: 'checkbox',
	checked: true,
	label: 'Always On Top',
	click: function(){
		overlay.setAlwaysOnTop(this.checked);
	}
}));

//Separator
menu.append(new gui.MenuItem({
	type: 'separator'
}));

//Exit
menu.append(new gui.MenuItem({
	label: 'Exit',
	click: function(){
		playlist.window.doExit();
	}
}));

//Create tray
var tray = new gui.Tray({
	title: 'Karaokyo',
	icon: 'assets/img/karaokyo-16x16.png',
	tooltip: 'Karaokyo',
	menu: menu
});

//--Window Events---------------------------------------------------------------------
//Chrome Events
chrome.on('close', function(){
	chromeMenuItem.checked = false;
	chrome.hide();
});
chrome.on('move', function(x, y){
	console.log('move');
	overlay.moveTo(x + trim, y + titlebar);
});
chrome.on('resize', function(width, height){
	console.log('resize');
	overlay.resizeTo(width - trim * 2, height - titlebar - trim);
  repaint();
});
chrome.on('minimize', function(){
	console.log('minimize');
	overlay.hide();
	isOverlayShowing = false;
});
chrome.on('restore', function(){
	console.log('restore');
	overlay.show();
	isOverlayShowing = true;
});
chrome.on('maximize', function(){
	console.log('max');
});
chrome.on('unmaximize', function(){
	console.log('unmax');
});

//Playlist Events
playlist.on('close', function(){
	playlistMenuItem.checked = false;
	playlist.hide();
});

//Options Events
options.on('close', function(){
	options.hide();
})

//Open Source Events
opensource.on('close', function(){
	opensource.hide();
})
//------------------------------------------------------------------------------------

//--Associated File Events------------------------------------------------------------
//File Opened with Karaokyo
gui.App.on('open', function(cmdline){
	playlistMenuItem.checked = true;
	playlist.show();
	playlist.focus();
	
	var args = cmdline.match(/"[^"]*"|[^\s"]+/g);
	for(var i = 0; i < args.length; i++){
		args[i] = args[i].replace(/"/g, '');
	}
	args = parseArgs(args)
	console.log(args);
	
	for(i = 1; i < args._.length; i++){
		playlist.window.addToPlaylist(args._[i]);
	}
});

//Launch while open
gui.App.on('reopen', function(cmdline){
	playlistMenuItem.checked = true;
	playlist.show();
	playlist.focus();
});