/*
 Copyright (c) 2010 Brian Silverman, Barry Silverman

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
*/

var centerx=300, centery=300;
var zoom=1;
var dragMouseX, dragMouseY, moved;
var statbox;
var animateChipLayout = true;
var userCode=[];
var userResetLow;
var userResetHigh;

// Some constants for the graphics presentation
// the canvas is embedded in an 800x600 clipping div
//   which gives rise to some of the 300 and 400 values in the code
//   there are also some 600 values
// the 6502D chip coords are in the box (216,179) to (8983,9807)
// we have 4 canvases all the same size, now 2000 pixels square
//   chip background - the layout
//   overlay - a red/white transparency to show logic high or low
//   hilite - to show the selected polygon
//   hitbuffer - abusing color values to return which polygon is under a point
// we no longer use a scaling transform - we now scale the chip data at 
//   the point of drawing line segments
// if the canvas is any smaller than chip coordinates there will be
//   rounding artifacts, and at high zoom there will be anti-aliasing on edges.
var grMaxZoom=12;
var grChipSize=10000;
var grChipOffsetY=0;

var w = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
var h = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);

var grCanvasSize=Math.min(w,h);
if(h>w) grCanvasSize += grCanvasSize/10
var grChipOffsetX=0;
// var grChipSize=grCanvasSize*4;
var grLineWidth=1;

// Index of layerNames corresponds to index into drawLayers
var layernames = ['metal', 'switched diffusion', 'inputdiode', 'grounded diffusion', 'powered diffusion', 'polysilicon'];
var colors = ['rgba(128,128,192,0.4)','#FFFF00','#FF00FF','#4DFF4D',
              '#FF4D4D','#801AC0','rgba(128,0,255,0.75)'];
var drawlayers = [true, true, true, true, true, true];
              
/////////////////////////
//
// Drawing Setup
//
/////////////////////////

// try to present a meaningful page before starting expensive work
function setup(){
	statbox = document.getElementById('status');
	setStatus('loading 6502...');
	setTimeout(setup_part2, 0);
}

function setup_part2(){
	frame = document.getElementById('frame');
	statbox = document.getElementById('status');
	setupNodes();
	setupTransistors();
	setupLayerVisibility();
	setupBackground();
	setupOverlay();
	setupHilite();
	setupHitBuffer();
	recenter();
	refresh();
	setupTable();
	window.onkeypress = function(e){handleKey(e);}
	hilite.onmousedown = function(e){mouseDown(e);}
	setStatus('resetting 6502...');
	setTimeout(setup_part3, 0);
}

function setup_part3(){
	loadProgram();
	writeTriggers={};  // kiosk mode does not handle I/O
	initChip();
	document.getElementById('stop').style.visibility = 'hidden';
	go();
}


/////////////////////////
//
// User Interface
//
/////////////////////////

function handleKey(e){
	var c = e.charCode || e.keyCode;
	c = String.fromCharCode(c);
	if('zx<>?np'.indexOf(c)==-1) return;
	else if(c=='?') setZoom(1);
	else if(c=='n') stepForward();
	else if(c=='p') stepBack();
}

function mouseDown(e){
	e.preventDefault();
	moved=false;	
	dragMouseX = e.clientX;	
	dragMouseY = e.clientY;
	window.onmousemove = function(e){mouseMove(e)};
	window.onmouseup = function(e){mouseUp(e)};
}

function mouseMove(e){
	moved = true;
	if(zoom==1) return;
	var dx = e.clientX-dragMouseX;
	var dy = e.clientY-dragMouseY;
	dragMouseX = e.clientX;
	dragMouseY = e.clientY;
	centerx-=dx/zoom;
	centerx = Math.max(centerx, 400/zoom);
	centerx = Math.min(centerx, 600-400/zoom);
	centery-=dy/zoom;
	centery = Math.max(centery, 300/zoom);
	centery = Math.min(centery, 600-300/zoom);
	recenter();
}

function mouseUp(e){
	if(!moved) handleClick(e);	
	window.onmousemove = undefined;
	window.onmouseup = undefined;
}

function setZoom(n){
	zoom = n;
	setChipStyle({
		width: 600*n+'px',
		height: 600*n+'px'
	});
	recenter();
}

function recenter(){
	var top = 0;
	var left = 0;
	if (w > grCanvasSize) {
		left = w/2 - (grCanvasSize - grCanvasSize/10)/2;
	} else {
		top = h/2 - grCanvasSize/2;
	}
	setChipStyle({
		top: top+'px',
		left: left+'px',
	});
}

function handleClick(e){
	var x = localx(hilite, e.clientX)/zoom;
	var y = localy(hilite, e.clientY)/zoom;
	var w = findNodeNumber(x,y);
	if(e.shiftKey) {
		getNodeGroup(w);
		hiliteNode(group);
	}
	else {var a=new Array(); a.push(w); hiliteNode(a);}
        var cx = Math.round(x*grChipSize/600);
        var cy = Math.round(y*grChipSize/600);
	if(w==-1) setStatus('x:',cx,'<br>','y:',cy);
	else {
		var s1='x: ' + cx + ' y: ' + cy;
                var s2='node: ' + w + ' ' + nodeName(w);
                setStatus(s1, s2);
	}
}

/////////////////////////
//
// Etc.
//
/////////////////////////

function setChipStyle(props){
	for(var i in props){
		chipbg.style[i] = props[i];
		overlay.style[i] = props[i];
		hilite.style[i] = props[i];
		hitbuffer.style[i] = props[i];
	}
}
