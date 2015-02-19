function setTextSize(size){
	document.body.style.fontSize = size/10 + "em";
}

function setTextColor(color){
	document.body.style.color = '#'+ color;
}

function setStrokeColor(color){
	//$('body').css('-webkit-text-stroke-color', '#' + color);
	//$('body').css('text-shadow', "-1px -1px 0 #" + color + ", 1px -1px 0 #" + color + ", -1px 1px 0 #" + color + ", 1px 1px 0 #" + color);
  $('body').css('text-shadow', "-1px -1px 0 #" + color + ", 1px -1px 0 #" + color + ", -1px 1px 0 #" + color + ", 1px 1px 0 #" + color + ", 0px -2px 0 #" + color + ", 2px  0px 0 #" + color + ", -2px 0px 0 #" + color + ", 0px 2px 0 #" + color);
}

function setHighlightColor(color){
	$('#customHighlightColor').text('div.over{color: #'+color+';}');
}

$(function(){
	var textSize = localStorage.textSize,
		textColor = localStorage.textColor,
		strokeColor = localStorage.strokeColor,
		highlightColor = localStorage.highlightColor;
	
	if(textSize){
		setTextSize(textSize);
	}
	if(textColor){
		setTextColor(textColor);
	}
	if(strokeColor){
		setStrokeColor(strokeColor);
	}
	if(highlightColor){
		setHighlightColor(highlightColor);
	}
});