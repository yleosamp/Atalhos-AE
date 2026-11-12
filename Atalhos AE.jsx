#target aftereffects
#targetengine "atalhos_ae_engine"

/*
 * Atalhos AE
 * Painel ScriptUI dockavel para Adobe After Effects.
 *
 * Novas acoes podem ser adicionadas no array ACTIONS ao final do arquivo.
 */
(function AtalhosAE(thisObj) {
    var PANEL_NAME = "Atalhos AE";
    var FOCAL_LENGTH_MM = 50;
    var FILM_SIZE_MM = 36;
    var BUTTON_SIZE = 42;
    var ICON_FOLDER_NAME = "Atalhos AE-assets";
    var SCRIPT_FOLDER = File($.fileName).parent;
    var AIRRACK_EFFECT_NAME = "Airrack Letras";
    var AIRRACK_EFFECT_MATCH_NAME = "Pseudo/Leoda Airrack Letras";
    var HOLOGRAM_SOURCE_TAG = "[Atalhos AE:HologramSource]";
    var HOLOGRAM_GLOW_TAG = "[Atalhos AE:HologramGlow]";
    var FLICKER_SOURCE_TAG = "[Atalhos AE:FlickerSource]";
    var FLICKER_STROKE_TAG = "[Atalhos AE:FlickerStroke]";
    var FLICKER_ANIMATOR_PREFIX = "Flicker Letras - ";
    var FLICKER_SPEED_EFFECT_NAME = "Flicker - Velocidade";
    var EXPERIMENTAL_3D_TAG = "[Atalhos AE:Experimental3D]";
    var state = $.global.__ATALHOS_AE_STATE__;

    if (!state) {
        state = {};
        $.global.__ATALHOS_AE_STATE__ = state;
    }

    function activeComp() {
        var item = app.project.activeItem;
        if (!item || !(item instanceof CompItem)) {
            alert("Abra ou selecione uma composicao primeiro.", PANEL_NAME);
            return null;
        }
        return item;
    }

    function topSelectedLayer(comp) {
        var selected = comp.selectedLayers;
        var result = null;
        var i;

        for (i = 0; i < selected.length; i += 1) {
            if (!result || selected[i].index < result.index) {
                result = selected[i];
            }
        }
        return result;
    }

    function selectOnly(comp, layers) {
        var i;
        var j;

        for (i = 1; i <= comp.numLayers; i += 1) {
            comp.layer(i).selected = false;
        }
        for (j = 0; j < layers.length; j += 1) {
            layers[j].selected = true;
        }
    }

    function positionAbove(layer, anchor) {
        if (anchor && anchor.containingComp === layer.containingComp) {
            layer.moveBefore(anchor);
        }
    }

    function createCameraRig() {
        var comp = activeComp();
        var anchor;
        var center;
        var zoom;
        var camera;
        var controller;
        var cameraTransform;
        var cameraOptions;
        var controllerTransform;

        if (!comp) {
            return;
        }

        anchor = topSelectedLayer(comp);
        center = [comp.width / 2, comp.height / 2];
        zoom = comp.width * FOCAL_LENGTH_MM / FILM_SIZE_MM;

        app.beginUndoGroup("Criar camera 50mm com controle");
        try {
            camera = comp.layers.addCamera("Camera 50mm", center);
            cameraTransform = camera.property("ADBE Transform Group");
            cameraOptions = camera.property("ADBE Camera Options Group");

            cameraTransform.property("ADBE Anchor Point").setValue([center[0], center[1], 0]);
            cameraTransform.property("ADBE Position").setValue([center[0], center[1], -zoom]);
            cameraOptions.property("ADBE Camera Zoom").setValue(zoom);

            controller = comp.layers.addNull(comp.duration);
            controller.name = "Camera CTRL";
            controller.threeDLayer = true;
            controllerTransform = controller.property("ADBE Transform Group");
            controllerTransform.property("ADBE Position").setValue([center[0], center[1], 0]);

            camera.parent = controller;

            if (anchor) {
                camera.moveBefore(anchor);
                controller.moveBefore(camera);
            }

            selectOnly(comp, [controller, camera]);
        } catch (error) {
            alert("Nao foi possivel criar o rig de camera.\n\n" + error.toString(), PANEL_NAME);
        } finally {
            app.endUndoGroup();
        }
    }

    function createNull() {
        var helper = File(SCRIPT_FOLDER.fsName + "/" + ICON_FOLDER_NAME + "/null-action.jsxinc");
        if (!helper.exists) {
            alert("Reinstale o Atalhos AE: o arquivo null-action.jsxinc nao foi encontrado.", PANEL_NAME);
            return;
        }
        $.evalFile(helper);
        return $.global.__ATALHOS_AE_NULL_ACTION__.run();
    }

    function createAdjustmentLayer() {
        var comp = activeComp();
        var anchor;
        var layer;

        if (!comp) {
            return;
        }

        anchor = topSelectedLayer(comp);
        app.beginUndoGroup("Criar adjustment layer");
        try {
            layer = comp.layers.addSolid(
                [1, 1, 1],
                "Adjustment Layer",
                comp.width,
                comp.height,
                comp.pixelAspect,
                comp.duration
            );
            layer.adjustmentLayer = true;
            positionAbove(layer, anchor);
            selectOnly(comp, [layer]);
        } catch (error) {
            alert("Nao foi possivel criar o adjustment layer.\n\n" + error.toString(), PANEL_NAME);
        } finally {
            app.endUndoGroup();
        }
    }

    function selectedKeyTargets(comp) {
        var result = [];
        var layers = comp.selectedLayers;
        var layerIndex;
        var propertyIndex;
        var keyIndex;
        var properties;
        var property;
        var keys;

        for (layerIndex = 0; layerIndex < layers.length; layerIndex += 1) {
            properties = layers[layerIndex].selectedProperties;
            for (propertyIndex = 0; propertyIndex < properties.length; propertyIndex += 1) {
                property = properties[propertyIndex];
                if (property.propertyType !== PropertyType.PROPERTY || property.numKeys < 1) {
                    continue;
                }
                keys = property.selectedKeys;
                for (keyIndex = 0; keyIndex < keys.length; keyIndex += 1) {
                    result.push({
                        property: property,
                        keyIndex: keys[keyIndex]
                    });
                }
            }
        }
        return result;
    }

    function easeValues(eases) {
        var values = [];
        var i;
        for (i = 0; i < eases.length; i += 1) {
            values.push({
                speed: eases[i].speed,
                influence: eases[i].influence
            });
        }
        return values;
    }

    function safeKeyFlag(property, methodName, keyIndex, fallback) {
        try {
            return property[methodName](keyIndex);
        } catch (ignore) {
            return fallback;
        }
    }

    function captureEase(target) {
        var property = target.property;
        var keyIndex = target.keyIndex;

        return {
            inEase: easeValues(property.keyInTemporalEase(keyIndex)),
            outEase: easeValues(property.keyOutTemporalEase(keyIndex)),
            inInterpolation: property.keyInInterpolationType(keyIndex),
            outInterpolation: property.keyOutInterpolationType(keyIndex),
            temporalContinuous: safeKeyFlag(property, "keyTemporalContinuous", keyIndex, false),
            temporalAutoBezier: safeKeyFlag(property, "keyTemporalAutoBezier", keyIndex, false)
        };
    }

    function createEaseArray(sourceValues, count) {
        var result = [];
        var i;
        var source;

        for (i = 0; i < count; i += 1) {
            source = sourceValues[Math.min(i, sourceValues.length - 1)];
            result.push(new KeyframeEase(source.speed, source.influence));
        }
        return result;
    }

    function applyEase(target, snapshot) {
        var property = target.property;
        var keyIndex = target.keyIndex;
        var dimensionCount = property.keyInTemporalEase(keyIndex).length;
        var hasBezier = snapshot.inInterpolation === KeyframeInterpolationType.BEZIER ||
            snapshot.outInterpolation === KeyframeInterpolationType.BEZIER;

        property.setInterpolationTypeAtKey(
            keyIndex,
            snapshot.inInterpolation,
            snapshot.outInterpolation
        );

        if (hasBezier) {
            try {
                property.setTemporalAutoBezierAtKey(keyIndex, false);
            } catch (ignoreAutoOff) {}
            try {
                property.setTemporalContinuousAtKey(keyIndex, false);
            } catch (ignoreContinuousOff) {}

            property.setTemporalEaseAtKey(
                keyIndex,
                createEaseArray(snapshot.inEase, dimensionCount),
                createEaseArray(snapshot.outEase, dimensionCount)
            );

            try {
                property.setTemporalContinuousAtKey(keyIndex, snapshot.temporalContinuous);
            } catch (ignoreContinuousOn) {}
            try {
                property.setTemporalAutoBezierAtKey(keyIndex, snapshot.temporalAutoBezier);
            } catch (ignoreAutoOn) {}
        }
    }

    function copyEase() {
        var comp = activeComp();
        var targets;
        var snapshots = [];
        var i;

        if (!comp) {
            return false;
        }

        targets = selectedKeyTargets(comp);
        if (targets.length < 1) {
            alert("Selecione pelo menos um keyframe para copiar o easing.", PANEL_NAME);
            return false;
        }

        try {
            for (i = 0; i < targets.length; i += 1) {
                snapshots.push(captureEase(targets[i]));
            }
            state.easeClipboard = snapshots;
            return true;
        } catch (error) {
            alert("Nao foi possivel copiar o easing deste keyframe.\n\n" + error.toString(), PANEL_NAME);
            return false;
        }
    }

    function pasteEase() {
        var comp = activeComp();
        var targets;
        var applied = 0;
        var skipped = 0;
        var i;
        var snapshot;

        if (!comp) {
            return;
        }
        if (!state.easeClipboard || state.easeClipboard.length < 1) {
            alert("Copie um easing primeiro.", PANEL_NAME);
            return;
        }

        targets = selectedKeyTargets(comp);
        if (targets.length < 1) {
            alert("Selecione os keyframes que vao receber o easing.", PANEL_NAME);
            return;
        }

        app.beginUndoGroup("Colar easing");
        try {
            for (i = 0; i < targets.length; i += 1) {
                snapshot = state.easeClipboard[i % state.easeClipboard.length];
                try {
                    applyEase(targets[i], snapshot);
                    applied += 1;
                } catch (ignoreKey) {
                    skipped += 1;
                }
            }
        } finally {
            app.endUndoGroup();
        }

        if (applied < 1) {
            alert("O easing nao pode ser aplicado aos keyframes selecionados.", PANEL_NAME);
        } else if (skipped > 0) {
            alert(
                "Easing aplicado em " + applied + " keyframe(s).\n" +
                skipped + " keyframe(s) incompativel(is) foi/foram ignorado(s).",
                PANEL_NAME
            );
        }
    }

    function addSliderControl(layer, name, defaultValue) {
        var effects = layer.property("ADBE Effect Parade");
        var effect = effects.property(name);
        var valueProperty;

        if (effect && effect.matchName !== "ADBE Slider Control") {
            effect.name = name + " - anterior";
            effect = null;
        }
        if (!effect) {
            effect = effects.addProperty("ADBE Slider Control");
            effect.name = name;
            valueProperty = effect.property("ADBE Slider Control-0001");
            valueProperty.setValue(defaultValue);
        }
        return effect;
    }

    function removeLegacyAirrackControls(layer) {
        var effects = layer.property("ADBE Effect Parade");
        var legacyNames = {
            "Airrack - Forca": true,
            "Airrack - Velocidade": true,
            "Airrack - Rotacao": true,
            "Airrack - Escala": true,
            "Airrack - Seed": true
        };
        var i;

        for (i = effects.numProperties; i >= 1; i -= 1) {
            if (legacyNames[effects.property(i).name]) {
                effects.property(i).remove();
            }
        }
    }

    function findAirrackEffect(effects) {
        var i;
        for (i = 1; i <= effects.numProperties; i += 1) {
            if (effects.property(i).matchName === AIRRACK_EFFECT_MATCH_NAME) {
                return effects.property(i);
            }
        }
        return null;
    }

    function ensureAirrackControls(layer) {
        var effects = layer.property("ADBE Effect Parade");
        var effect = findAirrackEffect(effects);
        var defaults = [0.4, 1.0, 1.6, 1.0, 1.0];
        var created = false;
        var i;

        if (!effect) {
            try {
                effect = effects.addProperty(AIRRACK_EFFECT_MATCH_NAME);
                created = true;
            } catch (ignorePseudoEffect) {
                effect = null;
            }
        }

        if (effect) {
            effect.name = AIRRACK_EFFECT_NAME;
            if (created) {
                for (i = 1; i <= defaults.length; i += 1) {
                    if (effect.property(i)) {
                        effect.property(i).setValue(defaults[i - 1]);
                    }
                }
            }
            removeLegacyAirrackControls(layer);
            return true;
        }

        // Mantem o botao funcional antes do primeiro reinicio do After Effects.
        addSliderControl(layer, "Airrack - Forca", defaults[0]);
        addSliderControl(layer, "Airrack - Velocidade", defaults[1]);
        addSliderControl(layer, "Airrack - Rotacao", defaults[2]);
        addSliderControl(layer, "Airrack - Escala", defaults[3]);
        addSliderControl(layer, "Airrack - Seed", defaults[4]);
        return false;
    }

    function airrackControlExpression(grouped, index, legacyName) {
        if (grouped) {
            return 'effect("' + AIRRACK_EFFECT_NAME + '")(' + index + ')';
        }
        return 'effect("' + legacyName + '")(1)';
    }

    function removeAirrackAnimators(layer) {
        var animators = layer.property("ADBE Text Properties").property("ADBE Text Animators");
        var i;

        for (i = animators.numProperties; i >= 1; i -= 1) {
            if (animators.property(i).name.indexOf("Airrack Letras - ") === 0) {
                animators.property(i).remove();
            }
        }
    }

    function selectorNoiseExpression(phase, grouped) {
        var speed = airrackControlExpression(grouped, 2, "Airrack - Velocidade");
        var seed = airrackControlExpression(grouped, 5, "Airrack - Seed");
        return [
            'var speed = Math.max(' + speed + ', 0) * 2.6;',
            'var seed = ' + seed + ';',
            'var t = (time - inPoint) * speed;',
            'var id = textIndex * 0.731 + seed * 13.17 + ' + phase + ';',
            'var organic = noise([id, t + ' + phase + ']);',
            'var pulse = Math.sin(t * Math.PI * 2 + id * 1.91);',
            'clamp((organic * 0.72 + pulse * 0.28) * 100, -100, 100);'
        ].join("\n");
    }

    function addExpressionSelector(animator, phase, grouped) {
        var selectors = animator.property("ADBE Text Selectors");
        var selector = selectors.addProperty("ADBE Text Expressible Selector");
        var basedOn = selector.property("ADBE Text Range Type2");
        var amount = selector.property("ADBE Text Expressible Amount");

        selector.name = "Por caractere";
        if (basedOn) {
            basedOn.setValue(2); // Characters Excluding Spaces
        }
        amount.expression = selectorNoiseExpression(phase, grouped);
        return selector;
    }

    function addAirrackAnimator(layer, name, propertyMatchName, propertyExpression, phase, grouped) {
        var animators = layer.property("ADBE Text Properties").property("ADBE Text Animators");
        var animator = animators.addProperty("ADBE Text Animator");
        var animatorProperties;
        var animatedProperty;

        animator.name = "Airrack Letras - " + name;
        animatorProperties = animator.property("ADBE Text Animator Properties");
        animatedProperty = animatorProperties.addProperty(propertyMatchName);
        animatedProperty.expression = propertyExpression;
        addExpressionSelector(animator, phase, grouped);
        return animator;
    }

    function applyAirrackTextMotion() {
        var comp = activeComp();
        var selected;
        var textLayers = [];
        var skipped = 0;
        var i;
        var layer;
        var firstApplied = null;
        var grouped;
        var strengthExpression;
        var rotationExpression;
        var scaleExpression;

        if (!comp) {
            return;
        }

        selected = comp.selectedLayers;
        for (i = 0; i < selected.length; i += 1) {
            if (selected[i].property("ADBE Text Properties") && !selected[i].locked) {
                textLayers.push(selected[i]);
            } else {
                skipped += 1;
            }
        }

        if (textLayers.length < 1) {
            alert("Selecione pelo menos uma camada de texto desbloqueada.", PANEL_NAME);
            return;
        }

        app.beginUndoGroup("Movimento de letras Airrack");
        try {
            for (i = 0; i < textLayers.length; i += 1) {
                layer = textLayers[i];
                grouped = ensureAirrackControls(layer);
                strengthExpression = airrackControlExpression(grouped, 1, "Airrack - Forca");
                rotationExpression = airrackControlExpression(grouped, 3, "Airrack - Rotacao");
                scaleExpression = airrackControlExpression(grouped, 4, "Airrack - Escala");

                removeAirrackAnimators(layer);

                addAirrackAnimator(
                    layer,
                    "Movimento X",
                    "ADBE Text Position 3D",
                    '[(' + strengthExpression + ') * 70, 0, 0]',
                    "0.17",
                    grouped
                );
                addAirrackAnimator(
                    layer,
                    "Movimento Y",
                    "ADBE Text Position 3D",
                    '[0, (' + strengthExpression + ') * 70, 0]',
                    "17.31",
                    grouped
                );
                addAirrackAnimator(
                    layer,
                    "Rotacao",
                    "ADBE Text Rotation",
                    '(' + rotationExpression + ') * 4.375',
                    "31.77",
                    grouped
                );
                addAirrackAnimator(
                    layer,
                    "Escala",
                    "ADBE Text Scale 3D",
                    'var s = (' + scaleExpression + ') * 4; [100 + s, 100 + s, 100]',
                    "49.23",
                    grouped
                );

                if (!firstApplied) {
                    firstApplied = layer;
                }
            }

            selectOnly(comp, textLayers);
        } catch (error) {
            alert("Nao foi possivel aplicar o movimento nas letras.\n\n" + error.toString(), PANEL_NAME);
        } finally {
            app.endUndoGroup();
        }

        if (firstApplied) {
            firstApplied.selected = true;
        }
        if (skipped > 0) {
            alert(skipped + " camada(s) que nao eram texto ou estavam bloqueadas foram ignoradas.", PANEL_NAME);
        }
    }

    function hasLayerTag(layer, tag) {
        return (layer.comment || "").indexOf(tag) >= 0;
    }

    function addLayerTag(layer, tag) {
        if (!hasLayerTag(layer, tag)) {
            layer.comment = layer.comment ? layer.comment + " " + tag : tag;
        }
    }

    function rgbFromHex(hex) {
        return [
            parseInt(hex.substr(0, 2), 16) / 255,
            parseInt(hex.substr(2, 2), 16) / 255,
            parseInt(hex.substr(4, 2), 16) / 255
        ];
    }

    function findBardowExtraBold() {
        var families;
        var familyIndex;
        var fontIndex;
        var font;
        var familyName;
        var styleName;

        try {
            families = app.fonts.allFonts;
            for (familyIndex = 0; familyIndex < families.length; familyIndex += 1) {
                for (fontIndex = 0; fontIndex < families[familyIndex].length; fontIndex += 1) {
                    font = families[familyIndex][fontIndex];
                    familyName = (font.familyName || "").toLowerCase();
                    styleName = (font.styleName || "").toLowerCase().replace(/\s/g, "");
                    if (familyName === "bardow" && styleName === "extrabold") {
                        return font.postScriptName;
                    }
                }
            }
        } catch (ignoreFontsApi) {}

        return "Bardow-ExtraBold";
    }

    function styleHologramTextLayer(layer, fillColor) {
        var sourceText = layer.property("ADBE Text Properties").property("ADBE Text Document");
        var document = sourceText.value;

        try {
            document.font = findBardowExtraBold();
        } catch (ignoreFont) {}
        document.fontSize = 36;
        document.tracking = -29;
        document.autoLeading = true;
        document.applyFill = true;
        document.fillColor = fillColor;
        document.applyStroke = true;
        document.strokeColor = [0, 0, 0];
        document.strokeWidth = 1;
        document.strokeOverFill = true;
        sourceText.setValue(document);
        return sourceText;
    }

    function removeExistingHologramGlow(comp, sourceLayer) {
        var i;
        var layer;

        for (i = comp.numLayers; i >= 1; i -= 1) {
            layer = comp.layer(i);
            if (layer !== sourceLayer && hasLayerTag(layer, HOLOGRAM_GLOW_TAG) && layer.parent === sourceLayer) {
                layer.remove();
            }
        }
    }

    function clearLayerEffects(layer) {
        var effects = layer.property("ADBE Effect Parade");
        var i;
        for (i = effects.numProperties; i >= 1; i -= 1) {
            effects.property(i).remove();
        }
    }

    function addVenetianBlinds(layer) {
        var effects = layer.property("ADBE Effect Parade");
        var effect = effects.addProperty("ADBE Venetian Blinds");

        effect.property(1).setValue(66);
        effect.property(2).setValue(90);
        effect.property(3).setValue(5);
        effect.property(4).setValue(0);
        return effect;
    }

    function setEffectValue(effect, matchName, value) {
        var property = effect.property(matchName);
        if (property) {
            property.setValue(value);
        }
    }

    function addDeepGlow(layer) {
        var effects = layer.property("ADBE Effect Parade");
        var effect = effects.addProperty("PEDG2");

        // Valores copiados do preset Hologram usado no projeto de referencia.
        setEffectValue(effect, "PEDG2-0103", 1);   // Glow Mode: Exponential
        setEffectValue(effect, "PEDG2-0024", 1);   // Blend Mode: Screen
        setEffectValue(effect, "PEDG2-0017", 117); // Radius
        setEffectValue(effect, "PEDG2-0018", 0.989); // Exposure
        setEffectValue(effect, "PEDG2-0053", 1);   // View: Final Result
        setEffectValue(effect, "PEDG2-0054", 100); // Source Opacity
        setEffectValue(effect, "PEDG2-0055", 1);   // Unmult
        return effect;
    }

    function uniqueProjectItemName(baseName) {
        var candidate = baseName;
        var suffix = 2;
        var i;
        var exists;

        while (true) {
            exists = false;
            for (i = 1; i <= app.project.numItems; i += 1) {
                if (app.project.item(i).name === candidate) {
                    exists = true;
                    break;
                }
            }
            if (!exists) {
                return candidate;
            }
            candidate = baseName + " " + suffix;
            suffix += 1;
        }
    }

    function advanced3DRendererName(comp) {
        var renderers = comp.renderers;
        var i;
        var rendererName;

        for (i = 0; i < renderers.length; i += 1) {
            rendererName = renderers[i];
            if (rendererName.toLowerCase().indexOf("advanced") >= 0) {
                return rendererName;
            }
        }
        return null;
    }

    function setPropertySafely(group, matchName, value) {
        var property;
        try {
            property = group && group.property(matchName);
            if (property) {
                property.setValue(value);
                return true;
            }
        } catch (ignoreProperty) {}
        return false;
    }

    function addAnimatorPropertySafely(properties, matchName, value) {
        var property;
        try {
            if (properties.canAddProperty(matchName)) {
                property = properties.addProperty(matchName);
                property.setValue(value);
                return property;
            }
        } catch (ignoreAnimatorProperty) {}
        return null;
    }

    function styleExperimental3DText(layer) {
        var textProperties = layer.property("ADBE Text Properties");
        var sourceText = textProperties.property("ADBE Text Document");
        var document = sourceText.value;
        var geometry;
        var material;
        var animators;
        var animator;
        var animatorProperties;
        var transform;

        document.applyFill = true;
        document.fillColor = rgbFromHex("08F51B");
        document.applyStroke = true;
        document.strokeColor = rgbFromHex("002707");
        document.strokeWidth = Math.max(3, document.fontSize * 0.035);
        document.strokeOverFill = true;
        sourceText.setValue(document);

        layer.threeDLayer = true;

        geometry = layer.property("ADBE Extrsn Options Group");
        if (!geometry) {
            throw new Error("O After Effects nao liberou as opcoes de extrusao para esta camada.");
        }
        setPropertySafely(geometry, "ADBE Bevel Styles", 4);       // Convex
        setPropertySafely(geometry, "ADBE Bevel Direction", 1);    // Para fora
        setPropertySafely(geometry, "ADBE Bevel Depth", 6);
        setPropertySafely(geometry, "ADBE Hole Bevel Depth", 50);
        setPropertySafely(geometry, "ADBE Extrsn Depth", 42);

        material = layer.property("ADBE Material Options Group");
        setPropertySafely(material, "ADBE Ambient Coefficient", 65);
        setPropertySafely(material, "ADBE Diffuse Coefficient", 85);
        setPropertySafely(material, "ADBE Specular Coefficient", 75);
        setPropertySafely(material, "ADBE Shininess Coefficient", 65);
        setPropertySafely(material, "ADBE Metal Coefficient", 10);

        // Cores distintas nas faces deixam o volume legivel mesmo sem textura.
        animators = textProperties.property("ADBE Text Animators");
        animator = animators.addProperty("ADBE Text Animator");
        animator.name = "Experimental 3D - Cores";
        animatorProperties = animator.property("ADBE Text Animator Properties");
        addAnimatorPropertySafely(animatorProperties, "ADBE 3DText Front RGB", rgbFromHex("08F51B"));
        addAnimatorPropertySafely(animatorProperties, "ADBE 3DText Bevel RGB", rgbFromHex("4CFF5A"));
        addAnimatorPropertySafely(animatorProperties, "ADBE 3DText Side RGB", rgbFromHex("006C13"));
        addAnimatorPropertySafely(animatorProperties, "ADBE 3DText Back RGB", rgbFromHex("002707"));

        transform = layer.property("ADBE Transform Group");
        setPropertySafely(transform, "ADBE Orientation", [4, -7, 0]);
    }

    function addExperimentalOuterEffects(layer) {
        var effects = layer.property("ADBE Effect Parade");
        var shadow;
        var glow = addDeepGlow(layer);

        // Glow moderado: o verde continua forte sem estourar o detalhe do bevel.
        setEffectValue(glow, "PEDG2-0017", 72);
        setEffectValue(glow, "PEDG2-0018", 0.72);

        try {
            if (effects.canAddProperty("ADBE Drop Shadow")) {
                shadow = effects.addProperty("ADBE Drop Shadow");
                shadow.property(1).setValue(rgbFromHex("001A05"));
                shadow.property(2).setValue(72);
                shadow.property(3).setValue(135);
                shadow.property(4).setValue(18);
                shadow.property(5).setValue(8);
            }
        } catch (ignoreShadow) {}
    }

    function findLayerUsingSource(comp, source) {
        var i;
        for (i = 1; i <= comp.numLayers; i += 1) {
            if (comp.layer(i).source === source) {
                return comp.layer(i);
            }
        }
        return null;
    }

    function createExperimental3DText() {
        var comp = activeComp();
        var selected;
        var sources = [];
        var created = [];
        var skipped = 0;
        var i;
        var layer;
        var innerComp;
        var innerText;
        var outerLayer;
        var rendererName;
        var precompName;

        if (!comp) {
            return;
        }

        selected = comp.selectedLayers;
        for (i = 0; i < selected.length; i += 1) {
            layer = selected[i];
            if (!layer.locked && layer.property("ADBE Text Properties")) {
                sources.push(layer);
            } else {
                skipped += 1;
            }
        }
        if (sources.length < 1) {
            alert("Selecione pelo menos uma camada de texto desbloqueada.", PANEL_NAME);
            return;
        }
        if (!sources[0].property("ADBE Effect Parade").canAddProperty("PEDG2")) {
            alert("O Deep Glow 2 nao foi encontrado. Verifique se o plugin esta instalado.", PANEL_NAME);
            return;
        }

        // Processar de baixo para cima evita que indices mudem entre precomposicoes.
        sources.sort(function (a, b) {
            return b.index - a.index;
        });

        app.beginUndoGroup("Texto 3D experimental");
        try {
            for (i = 0; i < sources.length; i += 1) {
                layer = sources[i];
                precompName = uniqueProjectItemName(layer.name + " - EXP 3D");
                innerComp = comp.layers.precompose([layer.index], precompName, true);
                rendererName = advanced3DRendererName(innerComp);
                if (!rendererName) {
                    throw new Error("O renderer Advanced 3D nao esta disponivel nesta versao do After Effects.");
                }
                innerComp.renderer = rendererName;

                innerText = innerComp.layer(1);
                innerText.name = innerText.name + " - TEXTO 3D";
                addLayerTag(innerText, EXPERIMENTAL_3D_TAG);
                styleExperimental3DText(innerText);

                outerLayer = findLayerUsingSource(comp, innerComp);
                if (!outerLayer) {
                    throw new Error("Nao foi possivel localizar a pre-composicao criada.");
                }
                outerLayer.name = precompName;
                addLayerTag(outerLayer, EXPERIMENTAL_3D_TAG);
                addExperimentalOuterEffects(outerLayer);
                created.push(outerLayer);
            }
            selectOnly(comp, created);
        } catch (error) {
            alert("Nao foi possivel criar o texto 3D experimental.\n\n" + error.toString(), PANEL_NAME);
        } finally {
            app.endUndoGroup();
        }

        if (skipped > 0) {
            alert(skipped + " camada(s) que nao eram texto ou estavam bloqueadas foram ignoradas.", PANEL_NAME);
        }
    }

    function buildHologramPair(sourceLayer) {
        var comp = sourceLayer.containingComp;
        var glowLayer;
        var glowSourceText;
        var teal = rgbFromHex("008C97");

        removeExistingHologramGlow(comp, sourceLayer);
        removeFlickerAnimators(sourceLayer);
        removeFlickerSpeedControl(sourceLayer);
        addLayerTag(sourceLayer, HOLOGRAM_SOURCE_TAG);
        styleHologramTextLayer(sourceLayer, rgbFromHex("C0E9FF"));

        glowLayer = sourceLayer.duplicate();
        glowLayer.name = sourceLayer.name + " - HOLOGRAMA";
        glowLayer.comment = HOLOGRAM_GLOW_TAG;
        glowLayer.parent = sourceLayer;
        clearLayerEffects(glowLayer);
        glowSourceText = styleHologramTextLayer(glowLayer, teal);
        glowSourceText.expression = [
            "var master = parent.text.sourceText;",
            "master.style",
            "    .setText(master.toString())",
            "    .setFillColor([0, 140/255, 151/255]);"
        ].join("\n");

        addVenetianBlinds(glowLayer);
        addDeepGlow(glowLayer);
        return glowLayer;
    }

    function applyHologramText() {
        var comp = activeComp();
        var selected;
        var sources = [];
        var createdLayers = [];
        var skipped = 0;
        var i;
        var j;
        var layer;
        var alreadyAdded;
        var withFlicker = false;

        try {
            withFlicker = ScriptUI.environment.keyboardState.shiftKey;
        } catch (ignoreKeyboardState) {}

        if (!comp) {
            return;
        }

        selected = comp.selectedLayers;
        for (i = 0; i < selected.length; i += 1) {
            layer = selected[i];
            if (hasLayerTag(layer, HOLOGRAM_GLOW_TAG) && layer.parent) {
                layer = layer.parent;
            }
            if (!layer.property("ADBE Text Properties") || layer.locked) {
                skipped += 1;
                continue;
            }

            alreadyAdded = false;
            for (j = 0; j < sources.length; j += 1) {
                if (sources[j] === layer) {
                    alreadyAdded = true;
                    break;
                }
            }
            if (!alreadyAdded) {
                sources.push(layer);
            }
        }

        if (sources.length < 1) {
            alert("Selecione pelo menos uma camada de texto desbloqueada.", PANEL_NAME);
            return;
        }
        if (!sources[0].property("ADBE Effect Parade").canAddProperty("PEDG2")) {
            alert("O Deep Glow 2 nao foi encontrado. Verifique se o plugin esta instalado.", PANEL_NAME);
            return;
        }

        app.beginUndoGroup("Texto Holograma MrBeast");
        try {
            for (i = 0; i < sources.length; i += 1) {
                layer = buildHologramPair(sources[i]);
                if (withFlicker) {
                    ensureFlickerSpeedControl(sources[i]);
                    addFlickerAnimator(sources[i], 34, Math.max(comp.time, sources[i].inPoint), false);
                    addFlickerAnimator(layer, 17, Math.max(comp.time, layer.inPoint), true);
                }
                createdLayers.push(sources[i]);
                createdLayers.push(layer);
            }
            selectOnly(comp, createdLayers);
        } catch (error) {
            alert("Nao foi possivel criar o texto holograma.\n\n" + error.toString(), PANEL_NAME);
        } finally {
            app.endUndoGroup();
        }

        if (skipped > 0) {
            alert(skipped + " camada(s) que nao eram texto ou estavam bloqueadas foram ignoradas.", PANEL_NAME);
        }
    }

    function findTaggedChild(comp, parentLayer, tag) {
        var i;
        var layer;
        for (i = 1; i <= comp.numLayers; i += 1) {
            layer = comp.layer(i);
            if (layer.parent === parentLayer && hasLayerTag(layer, tag)) {
                return layer;
            }
        }
        return null;
    }

    function removeFlickerAnimators(layer) {
        var textProperties = layer.property("ADBE Text Properties");
        var animators;
        var i;

        if (!textProperties) {
            return;
        }
        animators = textProperties.property("ADBE Text Animators");
        for (i = animators.numProperties; i >= 1; i -= 1) {
            if (animators.property(i).name.indexOf(FLICKER_ANIMATOR_PREFIX) === 0) {
                animators.property(i).remove();
            }
        }
    }

    function hasFlickerAnimator(layer) {
        var textProperties = layer.property("ADBE Text Properties");
        var animators;
        var i;

        if (!textProperties) {
            return false;
        }
        animators = textProperties.property("ADBE Text Animators");
        for (i = 1; i <= animators.numProperties; i += 1) {
            if (animators.property(i).name.indexOf(FLICKER_ANIMATOR_PREFIX) === 0) {
                return true;
            }
        }
        return false;
    }

    function setPropertyIfAvailable(property, value) {
        if (property) {
            property.setValue(value);
        }
    }

    function ensureFlickerSpeedControl(layer) {
        return addSliderControl(layer, FLICKER_SPEED_EFFECT_NAME, 1.0);
    }

    function removeFlickerSpeedControl(layer) {
        var effects = layer.property("ADBE Effect Parade");
        var i;
        for (i = effects.numProperties; i >= 1; i -= 1) {
            if (effects.property(i).name === FLICKER_SPEED_EFFECT_NAME &&
                    effects.property(i).matchName === "ADBE Slider Control") {
                effects.property(i).remove();
            }
        }
    }

    function selectorProperty(group, matchName, fallbackIndex) {
        var property = group.property(matchName);
        if (!property && fallbackIndex && fallbackIndex <= group.numProperties) {
            property = group.property(fallbackIndex);
        }
        return property;
    }

    function addFlickerAnimator(layer, seed, startTime, controlOnParent) {
        var textProperties = layer.property("ADBE Text Properties");
        var animators = textProperties.property("ADBE Text Animators");
        var animator;
        var animatorProperties;
        var opacity;
        var selectors;
        var selector;
        var start;
        var end;
        var offset;
        var advanced;
        var randomSeed;
        var startValues = "[0,35,58,40,68,55,72,62,78,70,82,76,86,80,90,85,93,88,96,92,100]";
        var startLiteral = startTime.toFixed(6);
        var speedReference = controlOnParent ?
            'parent.effect("' + FLICKER_SPEED_EFFECT_NAME + '")(1)' :
            'effect("' + FLICKER_SPEED_EFFECT_NAME + '")(1)';

        removeFlickerAnimators(layer);
        animator = animators.addProperty("ADBE Text Animator");
        animator.name = FLICKER_ANIMATOR_PREFIX + seed;
        animatorProperties = animator.property("ADBE Text Animator Properties");
        opacity = animatorProperties.addProperty("ADBE Text Opacity");
        opacity.setValue(0);

        selectors = animator.property("ADBE Text Selectors");
        selector = selectors.addProperty("ADBE Text Selector");
        selector.name = "Flicker Random";
        start = selector.property("ADBE Text Percent Start");
        end = selector.property("ADBE Text Percent End");
        offset = selector.property("ADBE Text Percent Offset");
        advanced = selector.property("ADBE Text Range Advanced");

        end.setValue(100);
        offset.setValue(0);
        setPropertyIfAvailable(selectorProperty(advanced, "ADBE Text Range Units", 1), 1);
        setPropertyIfAvailable(selectorProperty(advanced, "ADBE Text Range Type2", 2), 1);
        setPropertyIfAvailable(selectorProperty(advanced, "ADBE Text Selector Mode", 3), 1);
        setPropertyIfAvailable(selectorProperty(advanced, "ADBE Text Selector Max Amount", 4), 100);
        setPropertyIfAvailable(selectorProperty(advanced, "ADBE Text Range Shape", 5), 1);
        setPropertyIfAvailable(selectorProperty(advanced, "ADBE Text Selector Smoothness", 6), 100);
        setPropertyIfAvailable(selectorProperty(advanced, "ADBE Text Levels Max Ease", 7), 0);
        setPropertyIfAvailable(selectorProperty(advanced, "ADBE Text Levels Min Ease", 8), 0);
        setPropertyIfAvailable(selectorProperty(advanced, "ADBE Text Randomize Order", 9), 1);
        randomSeed = selectorProperty(advanced, "ADBE Text Random Seed", 10);

        start.expression = [
            "var values = " + startValues + ";",
            "var speed = Math.max(" + speedReference + ", 0.01);",
            "var f = Math.floor(((time - " + startLiteral + ") / thisComp.frameDuration) * speed + 0.0001);",
            "f < 0 ? 0 : (f >= values.length ? 100 : values[f]);"
        ].join("\n");
        if (randomSeed) {
            randomSeed.expression = [
                "var speed = Math.max(" + speedReference + ", 0.01);",
                "var f = Math.max(0, Math.floor(((time - " + startLiteral + ") / thisComp.frameDuration) * speed + 0.0001));",
                "(" + seed + " + f * 37) % 1000;"
            ].join("\n");
        }
        return animator;
    }

    function createFlickerStrokeLayer(sourceLayer) {
        var sourceText = sourceLayer.property("ADBE Text Properties").property("ADBE Text Document");
        var sourceDocument = sourceText.value;
        var strokeColor = [1, 1, 1];
        var strokeWidth = 1;
        var strokeLayer;
        var strokeText;
        var strokeDocument;

        try {
            strokeColor = sourceDocument.applyFill ? sourceDocument.fillColor : sourceDocument.strokeColor;
        } catch (ignoreSourceColor) {}
        try {
            strokeWidth = Math.max(sourceDocument.strokeWidth || 0, 1);
        } catch (ignoreStrokeWidth) {}

        addLayerTag(sourceLayer, FLICKER_SOURCE_TAG);
        sourceDocument.applyFill = true;
        sourceDocument.applyStroke = false;
        sourceText.setValue(sourceDocument);

        strokeLayer = sourceLayer.duplicate();
        strokeLayer.name = sourceLayer.name + " - FLICKER STROKE";
        strokeLayer.comment = FLICKER_STROKE_TAG;
        strokeLayer.parent = sourceLayer;
        strokeText = strokeLayer.property("ADBE Text Properties").property("ADBE Text Document");
        strokeDocument = strokeText.value;
        strokeDocument.applyFill = false;
        strokeDocument.applyStroke = true;
        strokeDocument.strokeColor = strokeColor;
        strokeDocument.strokeWidth = strokeWidth;
        strokeDocument.strokeOverFill = true;
        strokeText.setValue(strokeDocument);
        strokeText.expression = "hasParent ? parent.text.sourceText.toString() : value;";
        return strokeLayer;
    }

    function flickerSourceForLayer(layer) {
        if ((hasLayerTag(layer, FLICKER_STROKE_TAG) || hasLayerTag(layer, HOLOGRAM_GLOW_TAG)) && layer.parent) {
            return layer.parent;
        }
        return layer;
    }

    function flickerTargets(comp, sourceLayer, createPair) {
        var targets = [sourceLayer];
        var companion;

        if (hasLayerTag(sourceLayer, HOLOGRAM_SOURCE_TAG)) {
            companion = findTaggedChild(comp, sourceLayer, HOLOGRAM_GLOW_TAG);
        } else {
            companion = findTaggedChild(comp, sourceLayer, FLICKER_STROKE_TAG);
            if (!companion && createPair) {
                companion = createFlickerStrokeLayer(sourceLayer);
            }
        }
        if (companion) {
            targets.push(companion);
        }
        return targets;
    }

    function applyFlickerText() {
        var comp = activeComp();
        var selected;
        var sources = [];
        var affected = [];
        var skipped = 0;
        var i;
        var j;
        var source;
        var targets;
        var alreadyAdded;
        var removing;

        if (!comp) {
            return;
        }
        selected = comp.selectedLayers;
        for (i = 0; i < selected.length; i += 1) {
            source = flickerSourceForLayer(selected[i]);
            if (!source.property("ADBE Text Properties") || source.locked) {
                skipped += 1;
                continue;
            }
            alreadyAdded = false;
            for (j = 0; j < sources.length; j += 1) {
                if (sources[j] === source) {
                    alreadyAdded = true;
                    break;
                }
            }
            if (!alreadyAdded) {
                sources.push(source);
            }
        }

        if (sources.length < 1) {
            alert("Selecione pelo menos uma camada de texto desbloqueada.", PANEL_NAME);
            return;
        }

        app.beginUndoGroup("Flicker de texto");
        try {
            for (i = 0; i < sources.length; i += 1) {
                targets = flickerTargets(comp, sources[i], false);
                removing = false;
                for (j = 0; j < targets.length; j += 1) {
                    if (hasFlickerAnimator(targets[j])) {
                        removing = true;
                        break;
                    }
                }

                if (removing) {
                    for (j = 0; j < targets.length; j += 1) {
                        removeFlickerAnimators(targets[j]);
                        affected.push(targets[j]);
                    }
                    removeFlickerSpeedControl(sources[i]);
                } else {
                    targets = flickerTargets(comp, sources[i], true);
                    ensureFlickerSpeedControl(sources[i]);
                    for (j = 0; j < targets.length; j += 1) {
                        addFlickerAnimator(
                            targets[j],
                            j === 0 ? 34 : 17,
                            Math.max(comp.time, targets[j].inPoint),
                            j > 0
                        );
                        affected.push(targets[j]);
                    }
                }
            }
            selectOnly(comp, affected);
        } catch (error) {
            alert("Nao foi possivel aplicar o flicker.\n\n" + error.toString(), PANEL_NAME);
        } finally {
            app.endUndoGroup();
        }

        if (skipped > 0) {
            alert(skipped + " camada(s) que nao eram texto ou estavam bloqueadas foram ignoradas.", PANEL_NAME);
        }
    }

    var ACTIONS = [
        {
            id: "camera",
            icon: "camera.png",
            fallback: "50",
            tooltip: "Criar camera 50mm + nulo controlador",
            run: createCameraRig
        },
        {
            id: "null",
            icon: "null.png",
            fallback: "NULL",
            tooltip: "NULL: criar nulo. Com um nulo selecionado, cria um filho dele. Atalho N pelo comando zz Atalhos AE - NULL",
            run: createNull
        },
        {
            id: "adjustment",
            icon: "adjustment.png",
            fallback: "ADJ",
            tooltip: "Criar adjustment layer",
            run: createAdjustmentLayer
        },
        {
            id: "copyEase",
            icon: "copy-ease.png",
            fallback: "C",
            tooltip: "Copiar easing dos keyframes selecionados",
            run: copyEase
        },
        {
            id: "pasteEase",
            icon: "paste-ease.png",
            fallback: "P",
            tooltip: "Colar easing nos keyframes selecionados",
            run: pasteEase
        },
        {
            id: "airrackText",
            icon: "airrack-text.png",
            fallback: "TXT",
            tooltip: "Aplicar movimento dinamico por caractere ao texto selecionado",
            run: applyAirrackTextMotion
        },
        {
            id: "hologramText",
            icon: "hologram-text.png",
            fallback: "H",
            tooltip: "Criar texto holograma MrBeast. Segure Shift para adicionar flicker",
            run: applyHologramText
        },
        {
            id: "flickerText",
            icon: "flicker-text.png",
            fallback: "FLK",
            tooltip: "Aplicar/remover flicker. Shift + Holograma cria os dois juntos",
            run: applyFlickerText
        },
        {
            id: "experimental3DText",
            icon: "experimental-3d-text.png",
            fallback: "3D",
            tooltip: "Criar texto verde 3D experimental com bevel, extrusao e Deep Glow",
            run: createExperimental3DText
        }
    ];

    function buildUI(host) {
        var panel = host instanceof Panel ? host : new Window("palette", PANEL_NAME, undefined, {
            resizeable: true
        });
        var toolbar;
        var scriptFolder = File($.fileName).parent;
        var iconFolder = Folder(scriptFolder.fsName + "/" + ICON_FOLDER_NAME);
        var controls = {};
        var i;

        panel.orientation = "column";
        panel.alignChildren = ["fill", "fill"];
        panel.spacing = 0;
        panel.margins = 0;
        panel.minimumSize = [50, 50];
        panel.preferredSize = [ACTIONS.length * (BUTTON_SIZE + 4) + 4, 50];

        toolbar = panel.add("group");
        toolbar.orientation = "row";
        toolbar.alignChildren = ["center", "center"];
        toolbar.spacing = 4;
        toolbar.margins = 4;

        function addAction(action) {
            var button;
            var imageFile = File(iconFolder.fsName + "/" + action.icon);

            try {
                if (!imageFile.exists) {
                    throw new Error("Icone ausente");
                }
                button = toolbar.add(
                    "iconbutton",
                    undefined,
                    ScriptUI.newImage(imageFile),
                    {style: "toolbutton"}
                );
            } catch (ignoreImage) {
                button = toolbar.add("button", undefined, action.fallback);
            }

            button.preferredSize = [BUTTON_SIZE, BUTTON_SIZE];
            button.minimumSize = [BUTTON_SIZE, BUTTON_SIZE];
            button.maximumSize = [BUTTON_SIZE, BUTTON_SIZE];
            button.helpTip = action.tooltip;
            button.onClick = function () {
                var copied = action.run();
                if (action.id === "copyEase" && copied) {
                    controls.pasteEase.enabled = true;
                    controls.pasteEase.helpTip = "Colar " + state.easeClipboard.length +
                        " easing(s) nos keyframes selecionados";
                }
            };
            controls[action.id] = button;
        }

        for (i = 0; i < ACTIONS.length; i += 1) {
            addAction(ACTIONS[i]);
        }

        controls.pasteEase.enabled = !!(state.easeClipboard && state.easeClipboard.length);

        function reflow() {
            var horizontal = panel.size.width >= panel.size.height;
            var wantedOrientation = horizontal ? "row" : "column";

            if (toolbar.orientation !== wantedOrientation) {
                toolbar.orientation = wantedOrientation;
                panel.layout.layout(true);
            }
            panel.layout.resize();
        }

        panel.onResizing = panel.onResize = reflow;
        panel.layout.layout(true);
        reflow();

        return panel;
    }

    var ui = buildUI(thisObj);
    if (ui instanceof Window) {
        ui.center();
        ui.show();
    }
}(this));
