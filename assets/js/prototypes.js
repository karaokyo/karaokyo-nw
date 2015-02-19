//Exceptions
function NumberFormatException(message){
	this.name = "NumberFormatException";
	this.message = message;
}

//String Functions
String.prototype.toSeconds = function(){
	var data = this.split(':');
	
	if(data.length == 1){
		return parseFloat(data[0]);
	}
	else if(data.length == 2){
		return data[0] * 60 + parseFloat(data[1]);
	}
	else{
		throw new NumberFormatException("Invalid time format: \"" + this + "\", please validate your lyrics file.");
	}
};

Number.prototype.toTimeCode = function(){
	var minutes = Math.floor(this/60);
	var seconds = this%60;
	
	if(minutes != NaN){
		if(minutes !=0){
			return minutes + ":" + seconds;
		}
		else{
			return seconds;
		}
	}
	else{
		return NaN;
	}
};