var UiTextureEditor = IgeEventingClass.extend({
	classId: 'UiTextureEditor',
	
	init: function () {
		var self = this;
		ige.requireStylesheet(igeRoot + 'components/editor/ui/textureEditor/textureEditor.css');
		
		self.reset();
	},
	
	ready: function () {
		var self = this;
		
		ige.editor.ui.menus.addMenuGroup('toolsMenu', 'textures');
		ige.editor.ui.menus.addMenuItem('toolsMenu', 'textures', {
			id: 'textureEditor',
			icon: 'none',
			text: 'Texture Editor...',
			action: "ige.editor.ui.textureEditor.show();"
		});
	},
	
	reset: function () {
		var self = this;
		self._tempImages = [];
		self._images = [];
		self._cells = [];
		self._cellCount = 0;
		self._cellWidth = 0;
		self._cellHeight = 0;
	},
	
	show: function () {
		var self = this;
		self.reset();
		
		ige.editor.ui.dialogs.create({
			id: 'textureEditorDialog',
			icon: 'halflings-icon white picture',
			title: 'Texture Editor',
			contentTemplate: igeRoot + 'components/editor/ui/textureEditor/templates/textureEditor.html',
			blur: function () {
				ige.editor.ui.dialogs.confirm({
					title: 'Exit Texture Editor',
					width: 400,
					height: 150,
					contentData: {
						msg: 'Are you sure you want to exit the texture editor?',
						positiveTitle: 'OK',
						negativeTitle: 'Cancel'
					},
					
					ready: function () {
						
					},
					
					positive: function () {
						ige.editor.ui.dialogs.close('textureEditorDialog');
					}
				});
			},
			width: 800,
			height: 600,
			contentData: {
				canvasWidth: 800,
				canvasHeight: 568
			},
			callback: function (err, dialogElem) {
				if (!err) {
					// Add dialog controls
					ige.editor.ui.dialogs.addControl('textureEditorDialog', $('<div class="control sep"></div>'));
					ige.editor.ui.dialogs.addControl('textureEditorDialog', $('<div class="control download" title="Download as Image..."><span class="halflings-icon white download-alt"></span></div>'));
					ige.editor.ui.dialogs.addControl('textureEditorDialog', $('<div class="control clear" title="Clear"><span class="halflings-icon white file"></span></div>'));
					ige.editor.ui.dialogs.addControl('textureEditorDialog', $('<div class="control sep"></div>'));
					ige.editor.ui.dialogs.addControl('textureEditorDialog', $('<div class="control animate" title="Test as Animation..."><span class="halflings-icon white film"></span></div>'));
					ige.editor.ui.dialogs.addControl('textureEditorDialog', $('<div class="control sep"></div>'));
					ige.editor.ui.dialogs.addControl('textureEditorDialog', $('<div class="control help" title="Help..."><span class="halflings-icon white question-sign"></span></div>'));
					
					$('.control.download').on('click', function () { self.downloadImage(); });
					$('.control.clear').on('click', function () { self.clearImage(); });
					$('.control.animate').on('click', function () { self.toAnimationEditor(); });
					$('.control.help').on('click', function () { self.help(); });
					
					self.setupListeners(dialogElem);
					self.setupCanvas();
				}
			}
		});
	},
	
	setupListeners: function (dndTarget) {
		var self = this,
			overFunc,
			dropFunc;
		
		self._canvas = $('#textureEditorDialog').find('canvas');
		self._ctx = self._canvas[0].getContext('2d');
		
		// When moving over the canvas, highlight the cell
		self._canvas.on('mousemove', function (e) {
			var oe = e.originalEvent,
				cell;
			
			if (self._cellWidth && self._cellHeight) {
				self._highlightCell = self.cellFromXY(oe);
			}
		});
		
		self._canvas.on('mouseout', function (e) {
			delete self._highlightCell;
		});
		
		// If canvas is clicked, clear the cell
		self._canvas.on('click', function (e) {
			var oe = e.originalEvent,
				cell = self.cellFromXY(oe);
			
			if (self._cells[cell.x] && self._cells[cell.x][cell.y]) {
				self._images.pull(self._cells[cell.x][cell.y]);
				delete self._cells[cell.x][cell.y];
			}
		});
		
		// Setup live event listener for underlay drag and drop events
		overFunc = function (e) {
			var event = e.originalEvent;
			event.preventDefault();
			
			event.dataTransfer.dropEffect = 'add';
			return false;
		};
		
		dropFunc = function (e) {
			var event = e.originalEvent,
				dataTransfer = event.dataTransfer,
				reader;
			
			event.preventDefault();
			event.stopPropagation();
			
			if (dataTransfer.files && dataTransfer.files.length > 0) {
				if (dataTransfer.files.length > 1) {
					for (i = 0; i < dataTransfer.files.length; i++) {
						self._loadTempImage(dataTransfer.files[i]);
					}
					
					// Show multi-file input dialog
					ige.editor.ui.dialogs.input({
						id: 'multiFileInput',
						title: 'Multi-File Import',
						contentTemplate: igeRoot + 'components/editor/ui/textureEditor/templates/multiFiles.html',
						contentData: {
							fileCount: dataTransfer.files.length,
							positiveTitle: 'OK',
							negativeTitle: 'Cancel'
						},
						negative: function () {
							self._tempImages = [];
						},
						positive: function () {
							// Remove instructions
							$('#textureEditorDialog').find('.instructions').remove();
							
							// Get the selected number of columns
							var columns = $('#multiFileInput').find('select').val(),
								noBreak = true,
								i = 0,
								x = 0, y;
							
							// Find the next cell in a column-limited area
							while (noBreak) {
								y = Math.floor(i / columns);
								
								if (!self._cells[x] || (self._cells[x] && !self._cells[x][y])) {
									noBreak = false;
								} else {
									i++;
									x++;
									
									if (x >= columns) {
										x = 0;
									}
								}
							}
							
							for (i = 0; i < self._tempImages.length; i++) {
								if (self._cellCount === 0) {
									// This is the first image
									// Set the cell width and height from this image
									self._cellWidth = self._tempImages[i].width;
									self._cellHeight = self._tempImages[i].height;
								}
								
								self._cells[x] = self._cells[x] || [];
								self._cells[x][y] = self._tempImages[i];
								self._cellCount++;
								
								x++;
									
								if (x >= columns) {
									x = 0;
									y++;
								}
							}
							
							self._tempImages = [];
						}
					});
				} else {
					self._loadImage(dataTransfer.files[0]);
				}
			}
		};
		
		dndTarget.on('dragover', overFunc);
		dndTarget.on('drop', dropFunc);
	},
	
	_loadImage: function (file, callback) {
		var self = this,
			reader = new FileReader();
					
		reader.onload = function (event) {
			var img = new Image();
			
			img.onload = function () {
				self._images.push(img);
				
				if (self._cellCount === 0) {
					// This is the first image dropped
					self._cells[0] = self._cells[0] || [];
					self._cells[0][0] = img;
					
					// Set the cell width and height from this image
					self._cellWidth = img.width;
					self._cellHeight = img.height;
					
					// Remove instructions
					$('#textureEditorDialog').find('.instructions').remove();
				} else {
					var cell = self.cellFromXY(e.originalEvent);
					self._cells[cell.x] = self._cells[cell.x] || [];
					self._cells[cell.x][cell.y] = img;
				}
				
				self._cellCount++;
				
				if (callback) {
					callback();
				}
			};
			
			img.src = event.target.result;
		};
		
		reader.readAsDataURL(file);
	},
	
	_loadTempImage: function (file, callback) {
		var self = this,
			reader = new FileReader();
					
		reader.onload = function (event) {
			var img = new Image();
			
			img.onload = function () {
				self._tempImages.push(img);
				
				if (callback) {
					callback();
				}
			};
			
			img.src = event.target.result;
		};
		
		reader.readAsDataURL(file);
	},
	
	setupCanvas: function () {
		var self = this;
		
		// Start a canvas loop to draw data in a tick-fashion
		setInterval(function () { self._renderCanvas(); }, 1000 / 60);
	},
	
	getFinalTexture: function () {
		var self = this,
			drawnArea;
		
		// Render a frame without grid lines
		self._renderCanvas(true);
		drawnArea = self.drawnArea();
		
		if (drawnArea.width > 0 && drawnArea.height > 0) {
			// Create a new temp canvas and render the drawn area to it
			var newCanvas = document.createElement('canvas'),
				ctx;
			
			newCanvas.width = drawnArea.width;
			newCanvas.height = drawnArea.height;
			
			// Draw the data to the temp canvas
			ctx = newCanvas.getContext('2d');
			ctx.drawImage(self._canvas[0], 0, 0);
			
			return newCanvas;
		}
	},
	
	downloadImage: function () {
		var self = this,
			drawnArea,
			form = $('#textureEditorDialog').find('form'),
			imageDataElem = form.find('#formImageData'),
			newCanvas;
		
		// Render a frame without grid lines
		self._renderCanvas(true);
		drawnArea = self.drawnArea();
		
		if (drawnArea.width > 0 && drawnArea.height > 0) {
			newCanvas = self.getFinalTexture();
			
			// Download canvas image as png
			imageDataElem.val(newCanvas.toDataURL('image/png'));
			form[0].submit();
		}
	},
	
	clearImage: function () {
		var self = this;
		
		ige.editor.ui.dialogs.confirm({
			title: 'Clear Texture',
			width: 400,
			height: 150,
			contentData: {
				msg: 'Are you sure you want to clear this texture?',
				positiveTitle: 'OK',
				negativeTitle: 'Cancel'
			},
			
			ready: function () {
				
			},
			
			positive: function () {
				// Clear all the cell data
				self.reset();
			}
		});
	},
	
	toAnimationEditor: function () {
		var self = this;
		
		// Show the animation dialog with the texture and settings already filled in
		ige.editor.ui.animationEditor.show({
			textureImage: self.getFinalTexture(),
			cellWidth: self._cellWidth,
			cellHeight: self._cellHeight
		});
	},
	
	help: function () {
		var self = this;
		
		ige.editor.ui.dialogs.prompt({
			icon: 'halflings-icon white question-sign',
			title: 'Texture Editor Help',
			width: 400,
			height: 220,
			contentTemplate: igeRoot + 'components/editor/ui/textureEditor/templates/help.html',
			contentData: {
				positiveTitle: 'OK'
			}
		});
	},
	
	cellFromXY: function (event) {
		if (this._cellWidth && this._cellHeight) {
			return {
				x: Math.floor(event.offsetX / this._cellWidth),
				y: Math.floor(event.offsetY / this._cellHeight)
			};
		} else {
			return {
				x: 0,
				y: 0
			}
		}
	},
	
	drawnArea: function () {
		var self = this,
			maxX = 0,
			maxY = 0;
		
		if (self._cellWidth > 0 && self._cellHeight > 0) {
			for (x in self._cells) {
				if (self._cells.hasOwnProperty(x)) {
					for (y in self._cells[x]) {
						if (self._cells[x].hasOwnProperty(y)) {
							if (x > maxX) {
								maxX = x;
							}
							
							if (y > maxY) {
								maxY = y;
							}
						}
					}
				}
			}
			
			return {
				width: self._cellWidth + (maxX * self._cellWidth),
				height: self._cellHeight + (maxY * self._cellHeight)
			}
		} else {
			return {
				width: 0,
				height: 0
			}
		}
	},
	
	_renderCanvas: function (noGrid) {
		var self = this,
			ctx = self._ctx,
			cell,
			cellWidth,
			cellHeight;
		
		// Clear the canvas
		ctx.clearRect(0, 0, self._canvas[0].width, self._canvas[0].height);
		
		// Loop the cells and draw them
		for (x in self._cells) {
			if (self._cells.hasOwnProperty(x)) {
				for (y in self._cells[x]) {
					if (self._cells[x].hasOwnProperty(y)) {
						ctx.drawImage(self._cells[x][y], parseInt(x) * self._cellWidth, parseInt(y) * self._cellHeight);
					}
				}
			}
		}
		
		if (!noGrid) {
			cellWidth = self._cellWidth;
			cellHeight = self._cellHeight;
			
			// Draw highlighted cell
			cell = self._highlightCell;
			
			if (cell) {
				ctx.fillStyle = 'rgba(0, 0 , 0, 0.2)';
				ctx.fillRect(cell.x * cellWidth, cell.y * cellHeight, cellWidth, cellHeight);
			}
			
			// Draw cell grid
			if (cellWidth > 0 && cellHeight > 0) {
				ctx.strokeStyle = '#4affff';
				for (var x = 0; x < self._canvas[0].width; x += cellWidth) {
					ctx.beginPath();
					ctx.moveTo(x, 0);
					ctx.lineTo(x, self._canvas[0].height);
					ctx.stroke();
				}
				
				for (var y = 0; y < self._canvas[0].height; y += cellHeight) {
					ctx.beginPath();
					ctx.moveTo(0, y);
					ctx.lineTo(self._canvas[0].width, y);
					ctx.stroke();
				}
			}
		}
	}
});

// Init
ige.editor.ui.textureEditor = new UiTextureEditor();