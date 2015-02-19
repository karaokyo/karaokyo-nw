var dispatcher = window.opener;

$(function(){
	var textSize = localStorage.textSize,
		textColor = localStorage.textColor,
		strokeColor = localStorage.strokeColor,
		highlightColor = localStorage.highlightColor;
	
	if(!textSize){
		textSize = 10;
	}
	
	if(textColor){
		$('#textColor')[0].value = textColor;
	}
	if(strokeColor){
		$('#strokeColor')[0].value = strokeColor;
	}
	if(highlightColor){
		$('#highlightColor')[0].value = highlightColor;
	}
	
	$('#textSize').slider({
		range: "min",
		value: textSize,
		min: 5,
		max: 20,
		slide: function(event, ui){
			dispatcher.overlay.window.setTextSize(ui.value);
			dispatcher.repaint();
			localStorage.textSize = ui.value;
		}
	});
	$('#textColor').change(function(){
		dispatcher.overlay.window.setTextColor(this.value);
		localStorage.textColor = this.value;
	});
	$('#strokeColor').change(function(){
		dispatcher.overlay.window.setStrokeColor(this.value);
		localStorage.strokeColor = this.value;
	});
	$('#highlightColor').change(function(){
		dispatcher.overlay.window.setHighlightColor(this.value);
		localStorage.highlightColor = this.value;
	});
});